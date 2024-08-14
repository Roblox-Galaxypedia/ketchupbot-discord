using Discord.Interactions;

namespace ketchupbot_discord.Modules;

public class PingCommand : InteractionModuleBase<SocketInteractionContext>
{
    [SlashCommand("ping", "Replies with pong!")]
    public async Task PingAsync() => await RespondAsync($"Pong!\nGateway latency: {Context.Client.Latency}ms");
}