using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Discord;
using Discord.Commands;
using Discord.WebSocket;

namespace ketchupbot_discord;

public static class GalaxyGpt
{
    private static readonly HttpClient HttpClient = new();

    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public static async Task HandleMessage(SocketMessage messageParam, DiscordSocketClient client, ulong[]? allowedChannels = null)
    {
        if (messageParam is not SocketUserMessage message || message.Author.IsBot) return;

        if (allowedChannels != null && !allowedChannels.Contains(message.Channel.Id)) return;

        if (message.Content.Trim() == client.CurrentUser.Mention)
        {
            await message.ReplyAsync("""
                                     Hello! I'm KetchupBot. The official Galaxypedia Assistant & Automatic Updater!
                                     
                                     Updates ships every hour at XX:00
                                     Updates turrets page every hour at XX:30
                                     More information can be found here: <https://robloxgalaxy.wiki/wiki/User:Ketchupbot101>
                                     
                                     [Report](<https://discord.robloxgalaxy.wiki>) any unintended behaviour to Galaxypedia Head Staff immediately
                                     """);
            return;
        }

        int argPos = 0;
        if (!message.HasMentionPrefix(client.CurrentUser, ref argPos)) return;

        string messageContent = message.Content[argPos..].Trim();

        if (messageContent.Length > 750)
        {
            await message.ReplyAsync("Your question is too long! Please keep it under 750 characters.");
            return;
        }

        IDisposable? typingState = message.Channel.EnterTypingState();

        try
        {
            ApiResponse? apiResponse = await GetApiResponse(message, messageContent);

            if (apiResponse == null)
                throw new InvalidOperationException("Failed to get a response from the API");

            var answerMessage = new StringBuilder();

            const int maxResponseLength = 1900;
            if (apiResponse.Answer.Length > maxResponseLength)
                answerMessage.AppendLine(apiResponse.Answer[..Math.Min(apiResponse.Answer.Length, maxResponseLength)] + " (truncated)");
            else
                answerMessage.AppendLine(apiResponse.Answer);

            if (apiResponse.Duration != null) answerMessage.AppendLine($"Response Time: {apiResponse.Duration}ms (not including API transport overhead)");
            
            if (int.TryParse(apiResponse.QuestionTokens, out var questionTokens)) answerMessage.AppendLine($"Question Tokens: {questionTokens}");
            if (int.TryParse(apiResponse.ResponseTokens, out var responseTokens)) answerMessage.AppendLine($"Response Tokens: {responseTokens}");
            if (questionTokens == 0 && responseTokens == 0) answerMessage.AppendLine($"Cost: ${questionTokens * 0.00000015 + responseTokens * 0.0000006}");

            if (!string.IsNullOrWhiteSpace(apiResponse.Context))
            {
                using var contextStream = new MemoryStream(Encoding.UTF8.GetBytes(apiResponse.Context));

                await message.Channel.SendFileAsync(contextStream, "context.txt", answerMessage.ToString(), messageReference: new MessageReference(message.Id), allowedMentions: AllowedMentions.None);
            } else {
                await message.ReplyAsync(answerMessage.ToString(), allowedMentions: AllowedMentions.None);
            }
        }
        catch (Exception e)
        {
            Console.WriteLine(e);
            await message.ReplyAsync($"Sorry! An error occurred while processing your request.\nError Code: 0x{e.HResult:X8}");
        }
        finally
        {
            typingState.Dispose();
        }
    }

    private static async Task<ApiResponse?> GetApiResponse(SocketUserMessage message, string messageContent)
    {

            using HttpResponseMessage response =
                await HttpClient.PostAsJsonAsync(Environment.GetEnvironmentVariable("GPTAPIURL") ?? "http://localhost:3636/api/v1/ask", new
                {
                    prompt = messageContent,
                    username = message.Author.Username,
                    maxlength = 500
                });

            response.EnsureSuccessStatusCode();

            await using Stream responseContent = await response.Content.ReadAsStreamAsync();

            // Log the response content on a separate thread to prevent blocking the main thread
            await Task.Run(() =>
            {
                StreamReader reader = new(responseContent);
                Console.WriteLine(reader.ReadToEnd());
                responseContent.Seek(0, SeekOrigin.Begin);
            });

            var responseJson = await JsonSerializer.DeserializeAsync<ApiResponse>(responseContent, JsonSerializerOptions);

            return responseJson ?? throw new InvalidOperationException("Failed to deserialize response from API");
    }
}

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

