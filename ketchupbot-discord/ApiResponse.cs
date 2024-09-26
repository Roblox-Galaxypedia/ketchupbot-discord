using System.Text.Json.Serialization;

namespace ketchupbot_discord;

public class ApiResponse
{
    public required string Answer { get; init; }
    public string? Context { get; init; }
    
    [JsonPropertyName("question_tokens")]
    public string? QuestionTokens { get; init; }
    
    [JsonPropertyName("response_tokens")]
    public string? ResponseTokens { get; init; }

    // The following fields are not used in the Discord bot so they are commented out
    // public Dictionary<string, string>? Tokens { get; init; }

    // [JsonPropertyName("embeddings_usage")]
    // public Dictionary<string, string>? EmbeddingsUsage { get; init; }

    [JsonPropertyName("stop_reason")]
    public string? StopReason { get; init; }

    public string? Duration { get; init; }

    public string? Dataset { get; init; }
    public required string Version { get; init; }
}