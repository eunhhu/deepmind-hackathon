package auth

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	DefaultProjectID    = "h2gdm-hack26icn-2693"
	GoogleSecureCertURL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
	CertCacheTTL        = 1 * time.Hour
	contextUserKey      = "deepmind_auth_user"
)

type AuthProviderType string

const (
	ProviderAnonymous AuthProviderType = "anonymous"
	ProviderPassword  AuthProviderType = "password"
	ProviderGoogle    AuthProviderType = "google"
	ProviderDemo      AuthProviderType = "demo"
)

// AuthUser mirrors packages/shared/src/index.ts AuthUser
type AuthUser struct {
	UID         string           `json:"uid"`
	Email       string           `json:"email,omitempty"`
	DisplayName string           `json:"displayName,omitempty"`
	Provider    AuthProviderType `json:"provider"`
	IsAnonymous bool             `json:"isAnonymous"`
}

// AuthVerifyResponse mirrors packages/shared/src/index.ts AuthVerifyResponse
type AuthVerifyResponse struct {
	Authenticated bool     `json:"authenticated"`
	User          AuthUser `json:"user"`
	ProjectID     string   `json:"projectId"`
	StoreBackend  string   `json:"storeBackend"`
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	Typ string `json:"typ"`
}

type jwtClaims struct {
	Iss      string `json:"iss"`
	Aud      string `json:"aud"`
	Sub      string `json:"sub"`
	UserID   string `json:"user_id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Exp      int64  `json:"exp"`
	Iat      int64  `json:"iat"`
	Firebase struct {
		SignInProvider string `json:"sign_in_provider"`
	} `json:"firebase"`
}

// Verifier verifies Firebase / GCP Identity Platform RS256 ID tokens using Google X.509 certificates
// with zero external JWT library bloat.
type Verifier struct {
	projectID  string
	certURL    string
	httpClient *http.Client

	mu        sync.RWMutex
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
}

// NewVerifier creates a Firebase ID token verifier for the given GCP project ID.
// Defaults to GCP_PROJECT_ID, FIREBASE_PROJECT_ID, or "h2gdm-hack26icn-2693".
func NewVerifier(projectID string) *Verifier {
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		projectID = strings.TrimSpace(os.Getenv("GCP_PROJECT_ID"))
	}
	if projectID == "" {
		projectID = strings.TrimSpace(os.Getenv("FIREBASE_PROJECT_ID"))
	}
	if projectID == "" {
		projectID = DefaultProjectID
	}

	return &Verifier{
		projectID: projectID,
		certURL:   GoogleSecureCertURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		keys: make(map[string]*rsa.PublicKey),
	}
}

// ProjectID returns the configured GCP / Firebase project ID.
func (v *Verifier) ProjectID() string {
	return v.projectID
}

// SetCertURL overrides the Google SecureToken X.509 certificate endpoint (useful for unit tests).
func (v *Verifier) SetCertURL(url string) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.certURL = url
	v.expiresAt = time.Time{}
}

// VerifyIDToken parses and verifies a Firebase RS256 JWT token against cached X.509 certificates.
func (v *Verifier) VerifyIDToken(ctx context.Context, rawToken string) (AuthUser, error) {
	rawToken = strings.TrimSpace(rawToken)
	parts := strings.Split(rawToken, ".")
	if len(parts) != 3 {
		return AuthUser{}, errors.New("invalid JWT format: expected 3 dot-separated segments")
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return AuthUser{}, fmt.Errorf("decode JWT header: %w", err)
	}
	var hdr jwtHeader
	if err := json.Unmarshal(headerBytes, &hdr); err != nil {
		return AuthUser{}, fmt.Errorf("unmarshal JWT header: %w", err)
	}
	if hdr.Alg != "RS256" {
		return AuthUser{}, fmt.Errorf("unsupported JWT alg %q: expected RS256", hdr.Alg)
	}
	if strings.TrimSpace(hdr.Kid) == "" {
		return AuthUser{}, errors.New("missing JWT kid header")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return AuthUser{}, fmt.Errorf("decode JWT payload: %w", err)
	}
	var claims jwtClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return AuthUser{}, fmt.Errorf("unmarshal JWT claims: %w", err)
	}

	sigBytes, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return AuthUser{}, fmt.Errorf("decode JWT signature: %w", err)
	}

	expectedIss := "https://securetoken.google.com/" + v.projectID
	if claims.Iss != expectedIss {
		return AuthUser{}, fmt.Errorf("invalid JWT issuer %q: expected %q", claims.Iss, expectedIss)
	}
	if claims.Aud != v.projectID {
		return AuthUser{}, fmt.Errorf("invalid JWT audience %q: expected %q", claims.Aud, v.projectID)
	}
	now := time.Now().Unix()
	if claims.Exp <= now {
		return AuthUser{}, fmt.Errorf("JWT expired at %d (now %d)", claims.Exp, now)
	}

	uid := strings.TrimSpace(claims.Sub)
	if uid == "" {
		uid = strings.TrimSpace(claims.UserID)
	}
	if uid == "" {
		return AuthUser{}, errors.New("JWT missing sub/user_id claim")
	}

	pubKey, err := v.getPublicKey(ctx, hdr.Kid)
	if err != nil {
		return AuthUser{}, err
	}

	signedInput := parts[0] + "." + parts[1]
	digest := sha256.Sum256([]byte(signedInput))
	if err := rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, digest[:], sigBytes); err != nil {
		return AuthUser{}, fmt.Errorf("invalid JWT RS256 signature: %w", err)
	}

	provider, isAnon := mapFirebaseProvider(claims.Firebase.SignInProvider, claims.Email)
	displayName := claims.Name
	if displayName == "" && claims.Email != "" {
		displayName = strings.Split(claims.Email, "@")[0]
	}
	if displayName == "" {
		if isAnon {
			displayName = "Anonymous Hacker"
		} else {
			displayName = uid
		}
	}

	return AuthUser{
		UID:         uid,
		Email:       claims.Email,
		DisplayName: displayName,
		Provider:    provider,
		IsAnonymous: isAnon,
	}, nil
}

func mapFirebaseProvider(signInProvider, email string) (AuthProviderType, bool) {
	switch strings.ToLower(strings.TrimSpace(signInProvider)) {
	case "anonymous":
		return ProviderAnonymous, true
	case "google.com", "google":
		return ProviderGoogle, false
	case "password", "custom":
		return ProviderPassword, false
	default:
		if email != "" {
			return ProviderPassword, false
		}
		return ProviderAnonymous, true
	}
}

func (v *Verifier) getPublicKey(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	v.mu.RLock()
	now := time.Now()
	if now.Before(v.expiresAt) {
		if key, ok := v.keys[kid]; ok {
			v.mu.RUnlock()
			return key, nil
		}
	}
	v.mu.RUnlock()

	if err := v.refreshCerts(ctx); err != nil {
		return nil, err
	}

	v.mu.RLock()
	defer v.mu.RUnlock()
	key, ok := v.keys[kid]
	if !ok {
		return nil, fmt.Errorf("unknown JWT kid %q in Google X.509 certificates", kid)
	}
	return key, nil
}

func (v *Verifier) refreshCerts(ctx context.Context) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.certURL, nil)
	if err != nil {
		return fmt.Errorf("build cert request: %w", err)
	}

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("fetch Google X.509 certs: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read Google X.509 certs: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Google X.509 certs HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var certMap map[string]string
	if err := json.Unmarshal(body, &certMap); err != nil {
		return fmt.Errorf("unmarshal Google X.509 certs JSON: %w", err)
	}

	parsedKeys := make(map[string]*rsa.PublicKey, len(certMap))
	for kid, pemStr := range certMap {
		pubKey, err := parseRSAPublicKeyFromPEM(pemStr)
		if err != nil {
			return fmt.Errorf("parse X.509 cert for kid %q: %w", kid, err)
		}
		parsedKeys[kid] = pubKey
	}

	v.keys = parsedKeys
	v.expiresAt = time.Now().Add(CertCacheTTL)
	return nil
}

func parseRSAPublicKeyFromPEM(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("failed to decode PEM block")
	}

	if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
		if rsaPub, ok := cert.PublicKey.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
		return nil, errors.New("X.509 certificate does not contain an RSA public key")
	}

	if pubAny, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaPub, ok := pubAny.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
	}

	if rsaPub, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return rsaPub, nil
	}

	return nil, errors.New("unable to parse RSA public key from PEM")
}

// DefaultDemoUser returns the zero-friction fallback hackathon user when no token or header is supplied.
func DefaultDemoUser() AuthUser {
	return AuthUser{
		UID:         "demo-hacker",
		Email:       "hacker@h2gdm.local",
		DisplayName: "Demo Hacker",
		Provider:    ProviderDemo,
		IsAnonymous: false,
	}
}

// AuthMiddleware verifies `Authorization: Bearer <token>` via Verifier, supports `X-Demo-User`
// (and optional `X-Demo-Email`), and falls back to `DefaultDemoUser()` for zero-friction hackathon testing.
func AuthMiddleware(verifier *Verifier) gin.HandlerFunc {
	if verifier == nil {
		verifier = NewVerifier("")
	}
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
			rawToken := strings.TrimSpace(authHeader[7:])
			if rawToken != "" {
				if user, err := verifier.VerifyIDToken(c.Request.Context(), rawToken); err == nil {
					c.Set(contextUserKey, user)
					c.Next()
					return
				}
			}
		}

		if demoUID := strings.TrimSpace(c.GetHeader("X-Demo-User")); demoUID != "" {
			demoEmail := strings.TrimSpace(c.GetHeader("X-Demo-Email"))
			if demoEmail == "" {
				demoEmail = demoUID + "@demo.local"
			}
			user := AuthUser{
				UID:         demoUID,
				Email:       demoEmail,
				DisplayName: demoUID,
				Provider:    ProviderDemo,
				IsAnonymous: false,
			}
			c.Set(contextUserKey, user)
			c.Next()
			return
		}

		c.Set(contextUserKey, DefaultDemoUser())
		c.Next()
	}
}

// CurrentUser retrieves the authenticated AuthUser from the Gin context, falling back to DefaultDemoUser().
func CurrentUser(c *gin.Context) AuthUser {
	if c == nil {
		return DefaultDemoUser()
	}
	if val, exists := c.Get(contextUserKey); exists {
		if user, ok := val.(AuthUser); ok && user.UID != "" {
			return user
		}
	}
	return DefaultDemoUser()
}
