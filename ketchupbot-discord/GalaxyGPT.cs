using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Discord;
using Discord.Commands;
using Discord.WebSocket;

namespace ketchupbot_discord;

public static class GalaxyGpt
{
    private static readonly HttpClient HttpClient = new();

    private const int MaxResponseLength = 1900;

    public static async Task HandleMessage(SocketMessage messageParam, DiscordSocketClient client, ulong[]? allowedChannels = null)
    {
        if (messageParam is not SocketUserMessage message || message.Author.IsBot) return;

        if (allowedChannels != null && !allowedChannels.Contains(message.Channel.Id)) return;

        if (message.Type == MessageType.Reply && message.ReferencedMessage.Author.Id == client.CurrentUser.Id)
        {
            IDisposable? typing = message.Channel.EnterTypingState();
            JsonNode? finalResponse = await HandleConversation(client, message);

            await message.ReplyAsync(finalResponse?["message"]?.ToString());

            typing.Dispose();
            return;
        }

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
            ApiResponse apiResponse = await GetApiResponse(message, messageContent);

            // ReSharper disable once RedundantAssignment
            bool verbose = false;
#if DEBUG
            verbose = true;
#endif

            if (messageContent.Contains("+v", StringComparison.OrdinalIgnoreCase))
            {
                verbose = true;
                messageContent = messageContent.Replace("+v", "", StringComparison.OrdinalIgnoreCase).Trim();
            }

            var answerMessage = new StringBuilder();

            if (messageContent.Contains("best", StringComparison.OrdinalIgnoreCase))
            {
                answerMessage.AppendLine().AppendLine("""**Warning:** These kinds of questions have a high likelihood of being answered incorrectly. Please be more specific and avoid ambiguous questions like "what is the best super capital?" """);
            }

            #region Response Answer

            if (apiResponse.Answer.Length > MaxResponseLength)
                answerMessage.AppendLine(apiResponse.Answer[..Math.Min(apiResponse.Answer.Length, MaxResponseLength)] + " (truncated)");
            else
                answerMessage.AppendLine(apiResponse.Answer);

            #endregion

            #region Verbose Information

            if (verbose)
            {
                if (int.TryParse(apiResponse.QuestionTokens, out int questionTokens))
                    answerMessage.AppendLine($"Question Tokens: {questionTokens}");
                if (int.TryParse(apiResponse.ResponseTokens, out int responseTokens))
                    answerMessage.AppendLine($"Response Tokens: {responseTokens}");

                // NOTE: These numbers are hardcoded and not necessarily representative of the actual costs, as the model can change
                if (questionTokens != 0 && responseTokens != 0)
                    answerMessage.AppendLine($"Cost: ${Math.Round(questionTokens * 0.00000015 + responseTokens * 0.0000006, 10)}");

                if (apiResponse.Duration != null)
                    answerMessage.AppendLine(
                        $"Response Time: {apiResponse.Duration}ms (not including API transport overhead)");
            }

            #endregion

            #region Context Attacher and Message Sender

            if (!string.IsNullOrWhiteSpace(apiResponse.Context) && verbose)
            {
                using var contextStream = new MemoryStream(Encoding.UTF8.GetBytes(apiResponse.Context));
                await message.Channel.SendFileAsync(contextStream, "context.txt", answerMessage.ToString(), messageReference: new MessageReference(message.Id), allowedMentions: AllowedMentions.None);
            } else {
                await message.ReplyAsync(answerMessage.ToString(), allowedMentions: AllowedMentions.None);
            }

            #endregion
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

    private static async Task<JsonNode?> HandleConversation(DiscordSocketClient client, SocketUserMessage message)
    {
        // The message is a reply to the bot. Let's start by adding the message to the list, and setting the bot's message as the current message in the chain to process
        var messages = new List<IUserMessage> { message };
        IUserMessage messageToProcess = message.ReferencedMessage;

        while (true)
        {
            // Fetch the full message data from the API
            messageToProcess = await message.Channel.GetMessageAsync(messageToProcess.Id) as IUserMessage ?? throw new InvalidOperationException();

            // Find messages that are the user replying to the bot, or the bot replying to the user
            if (messageToProcess.Type == MessageType.Reply)
            {
                // Message is a reply to another message

                if (messageToProcess.ReferencedMessage.Author.Id == client.CurrentUser.Id)
                {
                    // The message is a reply to the bot, add it to the list and set the replied message as the current message in the chain
                    messages.Add(messageToProcess);
                    messageToProcess = messageToProcess.ReferencedMessage;
                    continue;
                }

                if (messageToProcess.ReferencedMessage.Author.Id == message.Author.Id)
                {
                    // The message is a reply to the user, add it to the list and set the replied message as the current message in the chain
                    messages.Add(messageToProcess);
                    messageToProcess = messageToProcess.ReferencedMessage;
                    continue;
                }
            }

            // The message is not a reply to the bot, and is not a reply to the user. This is the end of the chain
            messages.Add(messageToProcess);
            break;
        }

        messages.Reverse();

        // I can't be bothered to create a class for this so we're gonna be using dictionaries
        var messagesFormatted = new List<Dictionary<string, string>>();

        foreach (IUserMessage userMessage in messages)
        {
            if (userMessage.Author.Id == client.CurrentUser.Id)
            {
                messagesFormatted.Add(new Dictionary<string, string>()
                {
                    { "role", "assistant" },
                    { "message", userMessage.Content }
                });
            }
            else if (userMessage.Author.Id == message.Author.Id)
            {
                messagesFormatted.Add(new Dictionary<string, string>()
                {
                    { "role", "user" },
                    { "message", userMessage.Content }
                });
            }
            else
            {
                throw new InvalidOperationException("what the fuck is this?");
            }
        }

        using HttpResponseMessage response =
            await HttpClient.PostAsJsonAsync(
                "http://localhost:3636/api/v1/completeChat", new
                {
                    conversation = messagesFormatted,
                    username = message.Author.Username
                });

        response.EnsureSuccessStatusCode();

        Stream content = await response.Content.ReadAsStreamAsync();

        JsonNode jsonResponse = await JsonSerializer.DeserializeAsync<JsonNode>(content) ?? throw new InvalidOperationException();

        JsonNode? finalResponse = jsonResponse["conversation"]!.AsArray().Last(m => m?["role"]?.ToString() == "assistant");
        return finalResponse;
    }

    private static async Task<ApiResponse> GetApiResponse(SocketUserMessage message, string messageContent)
    {
        using HttpResponseMessage response =
            await HttpClient.PostAsJsonAsync(
                // TODO: This environment variable should be the base url, not the full url
                Environment.GetEnvironmentVariable("GPTAPIURL") ?? "http://localhost:3636/api/v1/ask", new
                {
                    prompt = messageContent,
                    username = message.Author.Username,
                    maxlength = 500,
                    maxcontextlength = 10
                });

        response.EnsureSuccessStatusCode();
        ApiResponse responseJson = await response.Content.ReadFromJsonAsync<ApiResponse>() ??
                                   throw new InvalidOperationException("Failed to deserialize response from API");

        return responseJson;
    }
}
