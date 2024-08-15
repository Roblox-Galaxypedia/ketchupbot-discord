using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Discord;
using Discord.Commands;
using Discord.WebSocket;

namespace ketchupbot_discord;

public static class DuckGen
{
    private static readonly HttpClient HttpClient = new();

    public static async Task HandleMessage(SocketMessage messageParam, DiscordSocketClient client)
    {
        if (messageParam is not SocketUserMessage message || message.Author.IsBot) return;

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

            if (apiResponse.Context != null)
            {
                var contextStream = new MemoryStream(Encoding.UTF8.GetBytes(apiResponse.Context));

                await message.Channel.SendFileAsync(contextStream, "context.txt", apiResponse.Answer, messageReference: new MessageReference(message.Id), allowedMentions: AllowedMentions.None);
            } else {
                await message.ReplyAsync(apiResponse.Answer, allowedMentions: AllowedMentions.None);
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
            using StringContent jsonContent = new(
                JsonSerializer.Serialize(new
                {
                    prompt = messageContent,
                    username = message.Author.Username
                }), Encoding.UTF8, "application/json");

            using HttpResponseMessage response =
                await HttpClient.PostAsync(Environment.GetEnvironmentVariable("GPTAPIURL") ?? "http://localhost:3636/api/v1/ask", jsonContent);

            response.EnsureSuccessStatusCode();

            string responseContent = await response.Content.ReadAsStringAsync();

            Console.WriteLine(responseContent);

            // I'm going to use a dynamic here because I'm procrastinating on creating a model for the response
            var responseJson = JsonSerializer.Deserialize<ApiResponse>(responseContent, new JsonSerializerOptions()
            {
                PropertyNameCaseInsensitive = true
            });

            return responseJson ?? throw new InvalidOperationException("Failed to deserialize response from API");
    }
}

public class ApiResponse
{
    public required string Answer { get; init; }
    public string? Context { get; init; }
    public Dictionary<string, string>? Tokens { get; init; }

    [JsonPropertyName("embeddings_usage")]
    public Dictionary<string, string>? EmbeddingsUsage { get; init; }

    [JsonPropertyName("stop_reason")]
    public string? StopReason { get; init; }

    public string? Dataset { get; init; }
    public required string Version { get; init; }
}

