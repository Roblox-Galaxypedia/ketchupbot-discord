import { Command, ChatInputCommand, CommandOptionsRunTypeEnum } from "@sapphire/framework"
import * as Discord from "discord.js"
import fetch from "node-fetch"

export class SearchCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, { 
            ...options,
            runIn: CommandOptionsRunTypeEnum.GuildText
        })
    }

    public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("search")
                .setDescription("Search the Galaxypedia")
        )
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const modal = new Discord.ModalBuilder()
            .setTitle("Galaxypedia Search")
            .setCustomId("search--query-modal")

        const queryinput = new Discord.TextInputBuilder()
            .setLabel("Query")
            .setCustomId("query")
            .setStyle(Discord.TextInputStyle.Short)
            .setRequired(true)

        const firstrow = new Discord.ActionRowBuilder<Discord.ModalActionRowComponentBuilder>().addComponents(queryinput)
        
        
        modal.addComponents(firstrow)

        await interaction.showModal(modal)
        
        interaction.awaitModalSubmit({ time: 60000, filter: (interaction) => interaction.customId === "search--query-modal" })
        .then(async (interaction) => {
            await interaction.deferReply({ ephemeral: true })
            const input = interaction.fields.getTextInputValue("query")

            const { query } = await fetch(`https://robloxgalaxy.wiki/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(input)}&srlimit=5`).then(response => response.json())

            if (query.search.length <= 0) return await interaction.editReply("No results found, please try again!")

            const titles: string[] = []

            query.search.forEach((result: any) => {
                titles.push(result.title)
            })

            const forembed = titles.map(val => {
                return `• [${val}](https://robloxgalaxy.wiki/wiki/${encodeURIComponent(val)})`
            })

            const searchresults = new Discord.EmbedBuilder()
                .setColor("#000000")
                .setAuthor({ name: "Galaxypedia", iconURL: "https://cdn.discordapp.com/icons/913914198344482846/09b983b97f42ca793f39199554eaf0f7.png?size=1024" })
                .setTitle(`Search results for **${input.toLowerCase().replace(/\w\S*/g, (txt) => { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase() })}**:`)
                .setDescription(`${forembed.join("\n\n")}\n\n[More...](https://robloxgalaxy.wiki/wiki/Special:Search?search=${encodeURIComponent(input)}&fulltext=1)`)
                .setFooter({ text: "The new era of the Galaxy Wiki" })

            await interaction.editReply({ embeds: [searchresults] })
        })
        .catch(error => {
            console.error(error)
            interaction.editReply("An error occured while trying to search the Galaxypedia!")   
        })
        
    }
}