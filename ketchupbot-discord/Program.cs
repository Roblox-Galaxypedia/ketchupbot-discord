using System.Reflection;
using Discord;
using Discord.Interactions;
using Discord.WebSocket;
using Microsoft.Extensions.Configuration;

namespace ketchupbot_discord;

public class Program
{
    private static DiscordSocketClient _client = null!;
    private static InteractionService _interactionService = null!;
    private static readonly IConfigurationRoot Configuration = new ConfigurationBuilder()
        .AddJsonFile("appsettings.json", optional: true, true)
        .AddEnvironmentVariables()
        .AddUserSecrets<Program>()
        .Build();

    public static async Task Main()
    {
        SentrySdk.Init(options =>
        {
            options.Dsn = Configuration["SENTRY_DSN"] ?? "https://fe5889aff53840ff6e748fd2de1cf963@o4507833886834688.ingest.us.sentry.io/4507992345214976";
            options.AutoSessionTracking = true;
            options.TracesSampleRate = 1.0;
            options.ProfilesSampleRate = 1.0;
        });

        _client = new DiscordSocketClient(new DiscordSocketConfig
        {
            GatewayIntents = (GatewayIntents.AllUnprivileged | GatewayIntents.MessageContent) & ~(GatewayIntents.GuildScheduledEvents | GatewayIntents.GuildInvites)
        });
        _interactionService = new InteractionService(_client.Rest);

        #region Event Handlers
        _client.Log += Log;
        _client.Ready += Ready;
        _client.Ready += BlogTrackerHandler;
        _client.MessageReceived += AutoPublishAnnouncements;
        _client.MessageReceived += DuckGenHandler;
        _client.InteractionCreated += async interaction =>
            await _interactionService.ExecuteCommandAsync(new SocketInteractionContext(_client, interaction), null);
        #endregion

        await _client.LoginAsync(TokenType.Bot, Configuration["DISCORD_TOKEN"]);
        await _client.StartAsync();

        await _interactionService.AddModulesAsync(Assembly.GetExecutingAssembly(), null);

        await Task.Delay(-1);
    }

    private static Task Log(LogMessage msg)
    {
        Console.WriteLine(msg.ToString());
        return Task.CompletedTask;
    }

    private static async Task Ready()
    {
        await _client.SetActivityAsync(new Game("the upstream API", ActivityType.Watching));

#if DEBUG
        await _interactionService.RegisterCommandsToGuildAsync(ulong.Parse(Configuration["TEST_GUILD_ID"] ?? throw new InvalidOperationException()));
#else
        await _interactionService.RegisterCommandsGloballyAsync();
#endif
    }

    private static async Task AutoPublishAnnouncements(SocketMessage messageParam)
    {
        // Check if the message is a user message and not from a bot
        if (messageParam is not SocketUserMessage message || message.Author.IsBot) return;

        // Check if the message is in the announcements channel
        if (message.Channel.GetChannelType() != ChannelType.News) return;

        List<ulong> allowedChannels =
        [
            956568339851931728,
            956568339851931728
        ];

        if (allowedChannels.Contains(message.Channel.Id)) await message.CrosspostAsync();
    }

    // Run the GalaxyGPT handler in a separate thread to prevent blocking the main thread
    private static Task DuckGenHandler(SocketMessage messageParam)
    {
        _ = Task.Run(async () => await GalaxyGpt.HandleMessage(messageParam, _client,
            Configuration["ALLOWED_CHANNELS"]?.Split(",").Select(item => ulong.Parse(item.Trim())).ToArray()));
        return Task.CompletedTask;
    }

    private static Task BlogTrackerHandler()
    {
        _ = Task.Run(async () =>
        {
            using var timer = new PeriodicTimer(TimeSpan.FromMinutes(15));

            while (await timer.WaitForNextTickAsync())
            {
                if (!BlogTracker.CheckForUpdates()) continue;

                if (await _client.GetChannelAsync(913918135785111572) is not IMessageChannel channel) throw new InvalidOperationException("Channel not found");

                await channel.SendMessageAsync($"@everyone New blog post!\n{BlogTracker.GetLatestPostUrl()}");
            }
        });
        return Task.CompletedTask;
    }
}