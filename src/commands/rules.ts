import { Command, ChatInputCommand, CommandOptionsRunTypeEnum } from "@sapphire/framework"
import * as Discord from "discord.js"

export class RulesCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, { 
            ...options,
            runIn: CommandOptionsRunTypeEnum.GuildAny,
        })
    }

    public override registerApplicationCommands(registry: ChatInputCommand.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName("rules")
                .setDescription("Rules for the server")
                .addBooleanOption((option) =>
                    option.setName("publish")
                        .setDescription("Send the rules to the rules channel?")
                        .setRequired(false)),
        )
    }

    public async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const shouldpublish = interaction.options.getBoolean("publish")
        await interaction.deferReply({ ephemeral: true })

        const embed = new Discord.EmbedBuilder()
            .setColor("#000000")
            .setTitle("Galaxypedia Discord Rules")
            .setAuthor({ name: "Galaxypedia", iconURL: interaction.client.user!.displayAvatarURL() })
            .setDescription("1. Abide by the [Discord ToS](https://discord.com/terms) and [Discord Guidelines](https://discord.com/guidelines).\n2. Do not harass others or organize, promote, or participate in harassment. Do not discriminate against others.\n3. ")
            .setTimestamp()
            .setFooter({ text: "Galaxypedia staff reserve the right to change these rules at any point in time | Do not try to find loopholes" })

    
        if (shouldpublish && interaction.member!.permissions instanceof Discord.PermissionsBitField && interaction.member!.permissions.has(Discord.PermissionsBitField.Flags.Administrator)) {
            const channel = await (await interaction.client.guilds.fetch("913914198344482846")).channels.fetch("913918133268545597")

            try {
                if (!channel) throw new Error("Channel not found!")
                if (!channel.isTextBased()) throw new Error("Channel is not a text channel!")
                
                await channel.send({ embeds: [embed] })
                await interaction.editReply({ content: "Done!" })
            } catch (err) {
                console.error(err)
                await interaction.editReply({ content: "Error!" })
            }
        } else {
            await interaction.editReply({ embeds: [embed] })
        }
    }
}