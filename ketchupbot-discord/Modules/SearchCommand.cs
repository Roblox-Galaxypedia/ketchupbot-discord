using Discord.Interactions;

namespace ketchupbot_discord.Modules;

public class SearchCommand : InteractionModuleBase<SocketInteractionContext>
{
    [SlashCommand("search", "Searches for a query on the Galaxypedia")]
    public async Task SearchAsync([Summary(description: "What to search for")] string query)
    {
        await RespondAsync("Not implemented yet!");
    }
}