package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
)

func generateTestCertAndKey(t *testing.T) (*rsa.PrivateKey, string) {
	t.Helper()
	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate RSA key: %v", err)
	}

	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: "securetoken.system.gserviceaccount.com",
		},
		NotBefore:             time.Now().Add(-1 * time.Hour),
		NotAfter:              time.Now().Add(24 * time.Hour),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		BasicConstraintsValid: true,
	}

	derBytes, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatalf("create X.509 certificate: %v", err)
	}

	pemBytes := pem.EncodeToMemory(&pem.Block{
		Type:  "CERTIFICATE",
		Bytes: derBytes,
	})
	return priv, string(pemBytes)
}

func signTestJWT(t *testing.T, priv *rsa.PrivateKey, kid string, claims map[string]interface{}) string {
	t.Helper()
	header := map[string]string{
		"alg": "RS256",
		"kid": kid,
		"typ": "JWT",
	}
	hdrBytes, err := json.Marshal(header)
	if err != nil {
		t.Fatalf("marshal header: %v", err)
	}
	payloadBytes, err := json.Marshal(claims)
	if err != nil {
		t.Fatalf("marshal claims: %v", err)
	}

	signingInput := base64.RawURLEncoding.EncodeToString(hdrBytes) + "." + base64.RawURLEncoding.EncodeToString(payloadBytes)
	digest := sha256.Sum256([]byte(signingInput))
	sig, err := rsa.SignPKCS1v15(rand.Reader, priv, crypto.SHA256, digest[:])
	if err != nil {
		t.Fatalf("sign JWT: %v", err)
	}

	return signingInput + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func TestVerifyFirebaseIDToken(t *testing.T) {
	priv, certPEM := generateTestCertAndKey(t)
	const kid = "test-kid-2026"
	const projectID = "h2gdm-hack26icn-2693"

	certServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			kid: certPEM,
		})
	}))
	defer certServer.Close()

	verifier := NewVerifier(projectID)
	verifier.SetCertURL(certServer.URL)

	validToken := signTestJWT(t, priv, kid, map[string]interface{}{
		"iss":   "https://securetoken.google.com/" + projectID,
		"aud":   projectID,
		"sub":   "firebase-uid-999",
		"email": "founder@deepmind.google",
		"name":  "Argon Builder",
		"iat":   time.Now().Add(-1 * time.Minute).Unix(),
		"exp":   time.Now().Add(30 * time.Minute).Unix(),
		"firebase": map[string]interface{}{
			"sign_in_provider": "password",
		},
	})

	user, err := verifier.VerifyIDToken(context.Background(), validToken)
	if err != nil {
		t.Fatalf("expected valid token to verify, got error: %v", err)
	}
	if user.UID != "firebase-uid-999" {
		t.Fatalf("expected UID firebase-uid-999, got %q", user.UID)
	}
	if user.Email != "founder@deepmind.google" {
		t.Fatalf("expected email founder@deepmind.google, got %q", user.Email)
	}
	if user.Provider != ProviderPassword || user.IsAnonymous {
		t.Fatalf("expected password provider (non-anonymous), got provider=%s isAnon=%v", user.Provider, user.IsAnonymous)
	}

	// Expired token should fail
	expiredToken := signTestJWT(t, priv, kid, map[string]interface{}{
		"iss": "https://securetoken.google.com/" + projectID,
		"aud": projectID,
		"sub": "firebase-uid-999",
		"exp": time.Now().Add(-5 * time.Minute).Unix(),
	})
	if _, err := verifier.VerifyIDToken(context.Background(), expiredToken); err == nil {
		t.Fatalf("expected expired token to fail verification")
	}

	// Wrong audience should fail
	wrongAudToken := signTestJWT(t, priv, kid, map[string]interface{}{
		"iss": "https://securetoken.google.com/" + projectID,
		"aud": "wrong-project-id",
		"sub": "firebase-uid-999",
		"exp": time.Now().Add(30 * time.Minute).Unix(),
	})
	if _, err := verifier.VerifyIDToken(context.Background(), wrongAudToken); err == nil {
		t.Fatalf("expected wrong audience token to fail verification")
	}
}

func TestAuthMiddlewareModes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	priv, certPEM := generateTestCertAndKey(t)
	const kid = "mw-kid-1"
	const projectID = "h2gdm-hack26icn-2693"

	certServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{kid: certPEM})
	}))
	defer certServer.Close()

	verifier := NewVerifier(projectID)
	verifier.SetCertURL(certServer.URL)

	r := gin.New()
	r.Use(AuthMiddleware(verifier))
	r.GET("/whoami", func(c *gin.Context) {
		c.JSON(http.StatusOK, CurrentUser(c))
	})

	// 1. Default fallback demo user
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest(http.MethodGet, "/whoami", nil)
	r.ServeHTTP(w1, req1)
	var u1 AuthUser
	if err := json.Unmarshal(w1.Body.Bytes(), &u1); err != nil {
		t.Fatalf("unmarshal fallback user: %v", err)
	}
	if u1.UID != "demo-hacker" || u1.Provider != ProviderDemo {
		t.Fatalf("expected demo-hacker fallback, got %+v", u1)
	}

	// 2. X-Demo-User + X-Demo-Email headers
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest(http.MethodGet, "/whoami", nil)
	req2.Header.Set("X-Demo-User", "team-alpha")
	req2.Header.Set("X-Demo-Email", "alpha@hackathon.dev")
	r.ServeHTTP(w2, req2)
	var u2 AuthUser
	if err := json.Unmarshal(w2.Body.Bytes(), &u2); err != nil {
		t.Fatalf("unmarshal X-Demo-User response: %v", err)
	}
	if u2.UID != "team-alpha" || u2.Email != "alpha@hackathon.dev" || u2.Provider != ProviderDemo {
		t.Fatalf("unexpected X-Demo-User result: %+v", u2)
	}

	// 3. Valid Bearer JWT token
	jwtToken := signTestJWT(t, priv, kid, map[string]interface{}{
		"iss": "https://securetoken.google.com/" + projectID,
		"aud": projectID,
		"sub": "anon-user-42",
		"exp": time.Now().Add(15 * time.Minute).Unix(),
		"firebase": map[string]interface{}{
			"sign_in_provider": "anonymous",
		},
	})
	w3 := httptest.NewRecorder()
	req3, _ := http.NewRequest(http.MethodGet, "/whoami", nil)
	req3.Header.Set("Authorization", "Bearer "+jwtToken)
	r.ServeHTTP(w3, req3)
	var u3 AuthUser
	if err := json.Unmarshal(w3.Body.Bytes(), &u3); err != nil {
		t.Fatalf("unmarshal Bearer JWT response: %v", err)
	}
	if u3.UID != "anon-user-42" || u3.Provider != ProviderAnonymous || !u3.IsAnonymous {
		t.Fatalf("unexpected Bearer JWT user: %+v", u3)
	}
}
