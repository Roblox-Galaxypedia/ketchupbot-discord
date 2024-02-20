import { Command } from "@sapphire/framework"
import { ketchupbot } from "../index"
import * as Discord from "discord.js"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class SlashCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: "stop",
            description: "Shut down Ketchupbot",
            runIn: ["GUILD_TEXT"],
        })
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
        )
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        if (!interaction.channel || !interaction.guild) return
        
		const confirm = new Discord.ButtonBuilder()
        .setCustomId("confirm")
        .setLabel("Confirm")
        .setStyle(Discord.ButtonStyle.Danger)
        
		const cancel = new Discord.ButtonBuilder()
        .setCustomId("cancel")
        .setLabel("Cancel")
        .setStyle(Discord.ButtonStyle.Secondary)
        
        const row: Discord.ActionRowBuilder<any> = new Discord.ActionRowBuilder().addComponents(cancel, confirm)
        
        
        await interaction.reply({
            ephemeral: true,
            content: "Are you sure you want to shut down Ketchupbot? This will stop hourly updates and the bot will need to be manually restarted\n*Note that if ketchupbot is running on Docker, it will automatically restart*",
            components: [row]
        })

        try {
            const buttonInteraction = await interaction.channel.awaitMessageComponent({ filter: (i) => i.user.id === interaction.user.id, time: 60000 })

            if (buttonInteraction.customId === "confirm") {
                await interaction.editReply({ content: "Shutting down...", components: [] })
                process.exit(1738)
            } else if (buttonInteraction.customId === "cancel") {
                await buttonInteraction.update({ content: "Action cancelled", components: [] })
            }
        } catch (e: any) {
            await interaction.editReply("Error: " + e.message)
        }
    }
}