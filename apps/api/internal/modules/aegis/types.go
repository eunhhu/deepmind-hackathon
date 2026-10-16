package aegis

// AegisIntakeMode defines how a target enters the Aegis pipeline.
type AegisIntakeMode string

const (
	IntakeModeGitHub AegisIntakeMode = "github"
	IntakeModeURLDNS AegisIntakeMode = "url-dns"
	IntakeModeBinary AegisIntakeMode = "binary"
)

// AegisTargetType defines the category of target being analyzed and protected.
type AegisTargetType string

const (
	TargetTypeWeb    AegisTargetType = "web"
	TargetTypeAPI    AegisTargetType = "api"
	TargetTypeBinary AegisTargetType = "binary"
)

// AegisRemediationMode defines how Aegis neutralizes a confirmed vulnerability.
type AegisRemediationMode string

const (
	RemediationModeGitPR       AegisRemediationMode = "git-pr"
	RemediationModeBinaryPatch AegisRemediationMode = "binary-patch"
	RemediationModeRouteShield AegisRemediationMode = "route-shield"
)

// AegisDefenseStatus tracks the current defense lifecycle of an Aegis project.
type AegisDefenseStatus string

const (
	DefenseStatusAuditing           AegisDefenseStatus = "auditing"
	DefenseStatusExploitVerifiedRed AegisDefenseStatus = "exploit_verified_red"
	DefenseStatusPatchedViaPR       AegisDefenseStatus = "patched_via_pr"
	DefenseStatusBinaryHardPatched  AegisDefenseStatus = "binary_hard_patched"
	DefenseStatusProtectedViaShield AegisDefenseStatus = "protected_via_route_shield"
)

// AegisTimelineStep represents one stage in the 4-stage Red-to-Green verification loop.
type AegisTimelineStep struct {
	Stage        string `json:"stage"`
	Title        string `json:"title"`
	ModelUsed    string `json:"modelUsed"`
	Status       string `json:"status"`
	DurationMs   int64  `json:"durationMs"`
	Summary      string `json:"summary"`
	CommandOrLog string `json:"commandOrLog"`
	Timestamp    string `json:"timestamp"`
}

// AegisCodePatchDiff represents a source-level vulnerability patch for GitHub PR remediation.
type AegisCodePatchDiff struct {
	FilePath    string `json:"filePath"`
	Language    string `json:"language"`
	BeforeCode  string `json:"beforeCode"`
	AfterCode   string `json:"afterCode"`
	UnifiedDiff string `json:"unifiedDiff"`
	Explanation string `json:"explanation"`
}

// AegisGitHubPrReport represents an automated pull request generated after Green verification.
type AegisGitHubPrReport struct {
	BranchName      string             `json:"branchName"`
	PrNumber        int                `json:"prNumber"`
	PrTitle         string             `json:"prTitle"`
	PrUrl           string             `json:"prUrl"`
	CommitSha       string             `json:"commitSha"`
	Status          string             `json:"status"`
	CiChecksPassed  bool               `json:"ciChecksPassed"`
	MarkdownComment string             `json:"markdownComment"`
	CodeDiff        AegisCodePatchDiff `json:"codeDiff"`
}

// AegisBinaryPatchInstruction describes a surgical byte-level patch inside an ELF/PE/Mach-O binary.
type AegisBinaryPatchInstruction struct {
	OffsetHex      string `json:"offsetHex"`
	Section        string `json:"section"`
	FunctionName   string `json:"functionName"`
	BeforeBytesHex string `json:"beforeBytesHex"`
	AfterBytesHex  string `json:"afterBytesHex"`
	BeforeAsm      string `json:"beforeAsm"`
	AfterAsm       string `json:"afterAsm"`
	Rationale      string `json:"rationale"`
}

// AegisBinaryProtections summarizes compiler and linker hardening flags in a binary.
type AegisBinaryProtections struct {
	NxEnabled   bool   `json:"nxEnabled"`
	PieEnabled  bool   `json:"pieEnabled"`
	StackCanary bool   `json:"stackCanary"`
	Relro       string `json:"relro"`
}

// AegisBinaryAnalysis holds disassembly, dangerous sinks, binary patches, and sandbox verification logs.
type AegisBinaryAnalysis struct {
	FileName          string                        `json:"fileName"`
	Format            string                        `json:"format"`
	FileSizeBytes     int64                         `json:"fileSizeBytes"`
	Sha256Before      string                        `json:"sha256Before"`
	Sha256After       string                        `json:"sha256After"`
	Protections       AegisBinaryProtections        `json:"protections"`
	DangerousSinks    []string                      `json:"dangerousSinks"`
	PatchInstructions []AegisBinaryPatchInstruction `json:"patchInstructions"`
	SandboxBeforeLog  string                        `json:"sandboxBeforeLog"`
	SandboxAfterLog   string                        `json:"sandboxAfterLog"`
	DownloadUrl       string                        `json:"downloadUrl"`
}

// AegisShieldSnippets provides ready-to-deploy WAF/middleware snippets across 5 edge & gateway stacks.
type AegisShieldSnippets struct {
	CloudRunGin      string `json:"cloudRunGin"`
	CloudArmor       string `json:"cloudArmor"`
	CloudflareWorker string `json:"cloudflareWorker"`
	Nginx            string `json:"nginx"`
	Envoy            string `json:"envoy"`
}

// AegisRouteShieldRule defines a live virtual patch (WAF/Route Shield) protecting an endpoint.
type AegisRouteShieldRule struct {
	RuleId               string              `json:"ruleId"`
	Enabled              bool                `json:"enabled"`
	ProtectedPath        string              `json:"protectedPath"`
	Methods              []string            `json:"methods"`
	BlockPatternRegex    string              `json:"blockPatternRegex"`
	RateLimitRps         int                 `json:"rateLimitRps"`
	BlockedRequestsCount int                 `json:"blockedRequestsCount"`
	LastBlockedAt        string              `json:"lastBlockedAt,omitempty"`
	SampleAttackPayload  string              `json:"sampleAttackPayload"`
	Snippets             AegisShieldSnippets `json:"snippets"`
}

// AegisVulnerabilityFinding represents an exploit-verified vulnerability with Red and Green proof logs.
type AegisVulnerabilityFinding struct {
	Id                         string  `json:"id"`
	CveOrCwe                   string  `json:"cveOrCwe"`
	Title                      string  `json:"title"`
	Severity                   string  `json:"severity"`
	CvssScore                  float64 `json:"cvssScore"`
	Location                   string  `json:"location"`
	RootCause                  string  `json:"rootCause"`
	AttackVector               string  `json:"attackVector"`
	PocPayload                 string  `json:"pocPayload"`
	PocRedLog                  string  `json:"pocRedLog"`
	VerifyGreenLog             string  `json:"verifyGreenLog"`
	ZeroFalsePositiveConfirmed bool    `json:"zeroFalsePositiveConfirmed"`
}

// AegisProject represents a security target managed by Aegis across Whitebox GitHub, Blackbox URL, or Binary modes.
type AegisProject struct {
	Id                 string                      `json:"id"`
	Name               string                      `json:"name"`
	Subtitle           string                      `json:"subtitle"`
	IntakeMode         AegisIntakeMode             `json:"intakeMode"`
	TargetType         AegisTargetType             `json:"targetType"`
	RemediationMode    AegisRemediationMode        `json:"remediationMode"`
	DefenseStatus      AegisDefenseStatus          `json:"defenseStatus"`
	RepoUrl            string                      `json:"repoUrl,omitempty"`
	CdWorkflowPath     string                      `json:"cdWorkflowPath,omitempty"`
	TargetUrl          string                      `json:"targetUrl,omitempty"`
	DnsDomain          string                      `json:"dnsDomain,omitempty"`
	DnsTxtRecordName   string                      `json:"dnsTxtRecordName,omitempty"`
	DnsTxtToken        string                      `json:"dnsTxtToken,omitempty"`
	DnsVerified        bool                        `json:"dnsVerified"`
	BinaryFileName     string                      `json:"binaryFileName,omitempty"`
	Vulnerabilities    []AegisVulnerabilityFinding `json:"vulnerabilities"`
	Timeline           []AegisTimelineStep         `json:"timeline"`
	GitPrReport        *AegisGitHubPrReport        `json:"gitPrReport,omitempty"`
	BinaryAnalysis     *AegisBinaryAnalysis        `json:"binaryAnalysis,omitempty"`
	RouteShield        *AegisRouteShieldRule       `json:"routeShield,omitempty"`
	LastScanDurationMs int64                       `json:"lastScanDurationMs"`
	UpdatedAt          string                      `json:"updatedAt"`
}

// CreateAegisProjectRequest is the request payload to onboard a new Aegis target.
type CreateAegisProjectRequest struct {
	Name              string               `json:"name"`
	Subtitle          string               `json:"subtitle,omitempty"`
	IntakeMode        AegisIntakeMode      `json:"intakeMode"`
	TargetType        AegisTargetType      `json:"targetType,omitempty"`
	RemediationMode   AegisRemediationMode `json:"remediationMode,omitempty"`
	RepoUrl           string               `json:"repoUrl,omitempty"`
	CdWorkflowPath    string               `json:"cdWorkflowPath,omitempty"`
	CdConfigSnippet   string               `json:"cdConfigSnippet,omitempty"`
	TargetUrl         string               `json:"targetUrl,omitempty"`
	DnsDomain         string               `json:"dnsDomain,omitempty"`
	BinaryFileName    string               `json:"binaryFileName,omitempty"`
	BinarySizeBytes   int64                `json:"binarySizeBytes,omitempty"`
	BinaryHexPreview  string               `json:"binaryHexPreview,omitempty"`
}

// AegisVerifyDnsRequest verifies domain ownership via DNS TXT record before active blackbox probing.
type AegisVerifyDnsRequest struct {
	ProjectId              string `json:"projectId,omitempty"`
	Domain                 string `json:"domain,omitempty"`
	TxtToken               string `json:"txtToken,omitempty"`
	SimulateTxtPropagation bool   `json:"simulateTxtPropagation,omitempty"`
}

// AegisVerifyDnsResponse returns the DNS TXT verification status and updated project.
type AegisVerifyDnsResponse struct {
	ProjectId       string       `json:"projectId"`
	Domain          string       `json:"domain"`
	TxtRecordName   string       `json:"txtRecordName"`
	ExpectedToken   string       `json:"expectedToken"`
	DnsVerified     bool         `json:"dnsVerified"`
	Verified        bool         `json:"verified"`
	ResolverUsed    string       `json:"resolverUsed"`
	Message         string       `json:"message"`
	CheckedAt       string       `json:"checkedAt"`
	Project         AegisProject `json:"project"`
}

// AegisRunPipelineRequest triggers the 4-stage Recon -> PoC (Red) -> Remediate -> Verify (Green) loop.
type AegisRunPipelineRequest struct {
	ProjectId               string               `json:"projectId,omitempty"`
	RemediationMode         AegisRemediationMode `json:"remediationMode,omitempty"`
	RemediationModeOverride AegisRemediationMode `json:"remediationModeOverride,omitempty"`
	ThinkingLevel           string               `json:"thinkingLevel,omitempty"`
	CustomTargetHint        string               `json:"customTargetHint,omitempty"`
	DryRun                  bool                 `json:"dryRun,omitempty"`
}

// AegisRunPipelineResponse returns the updated Aegis project and executive summary after pipeline execution.
type AegisRunPipelineResponse struct {
	Project            AegisProject `json:"project"`
	InteractionIds     []string     `json:"interactionIds"`
	TotalDurationMs    int64        `json:"totalDurationMs"`
	ModelUsed          string       `json:"modelUsed"`
	ThinkingLevel      string       `json:"thinkingLevel"`
	ZeroFalsePositives bool         `json:"zeroFalsePositives"`
	SummaryMarkdown    string       `json:"summaryMarkdown"`
}

// AegisShieldTestAttackRequest tests an exploit payload against an active Aegis Route Shield rule.
type AegisShieldTestAttackRequest struct {
	ProjectId     string `json:"projectId,omitempty"`
	AttackPath    string `json:"attackPath,omitempty"`
	AttackPayload string `json:"attackPayload,omitempty"`
	RequestPath   string `json:"requestPath,omitempty"`
	Method        string `json:"method,omitempty"`
	Payload       string `json:"payload,omitempty"`
}

// AegisShieldTestAttackResponse returns whether the simulated attack was intercepted by the Route Shield.
type AegisShieldTestAttackResponse struct {
	ProjectId            string                `json:"projectId"`
	ShieldEnabled        bool                  `json:"shieldEnabled"`
	Blocked              bool                  `json:"blocked"`
	HttpStatus           int                   `json:"httpStatus"`
	StatusCode           int                   `json:"statusCode"`
	Verdict              string                `json:"verdict"`
	RuleTriggered        string                `json:"ruleTriggered,omitempty"`
	ResponseBody         string                `json:"responseBody"`
	LatencyMs            int64                 `json:"latencyMs"`
	BlockedRequestsCount int                   `json:"blockedRequestsCount"`
	UpdatedRule          *AegisRouteShieldRule `json:"updatedRule,omitempty"`
	Project              AegisProject          `json:"project"`
}

// AegisScanStreamEvent is emitted over SSE during POST /projects/:id/scan/stream.
type AegisScanStreamEvent struct {
	Type            string             `json:"type"`
	StageIndex      int                `json:"stageIndex,omitempty"`
	Step            *AegisTimelineStep `json:"step,omitempty"`
	Project         *AegisProject      `json:"project,omitempty"`
	InteractionIds  []string           `json:"interactionIds,omitempty"`
	TotalDurationMs int64              `json:"totalDurationMs,omitempty"`
}

// AegisBinaryUploadRequest accepts a raw binary (base64 encoded) for ELF/PE/Mach-O inspection and hot-patching.
type AegisBinaryUploadRequest struct {
	FileName   string `json:"fileName"`
	Format     string `json:"format,omitempty"`
	Base64Data string `json:"base64Data"`
}

// AegisUpdateShieldRuleRequest updates the active WAF regex and rate limit on a project's Route Shield.
type AegisUpdateShieldRuleRequest struct {
	ProtectedPath      string   `json:"protectedPath,omitempty"`
	Methods            []string `json:"methods,omitempty"`
	MitigationPattern  string   `json:"mitigationPattern,omitempty"`
	RateLimitPerMinute int      `json:"rateLimitPerMinute,omitempty"`
}

// AegisCreatePrResponse returns the generated GitHub PR metadata and CLI/patch links.
type AegisCreatePrResponse struct {
	ProjectId    string       `json:"projectId"`
	PrUrl        string       `json:"prUrl"`
	PrBranch     string       `json:"prBranch"`
	PrNumber     int          `json:"prNumber"`
	PrTitle      string       `json:"prTitle"`
	Status       string       `json:"status"`
	PatchFileUrl string       `json:"patchFileUrl"`
	GhCliCommand string       `json:"ghCliCommand"`
	Project      AegisProject `json:"project"`
}


