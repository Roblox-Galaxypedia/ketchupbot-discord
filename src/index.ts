import dotenv from "dotenv"
dotenv.config()

import { SapphireClient, Events } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"
import * as ketchuplib from "./ketchupbot"
import fetch from "node-fetch"
import * as cron from "node-cron"
import * as Discord from "discord.js"

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const bot = new SapphireClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] })
export const ketchupbot = new ketchuplib.ShipUpdater()

async function logChange(name: string, revision: { revid: string | number } | null) {
    await fetch(process.env.WEBHOOK!, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: `Updated **${name}**! ${(revision ? `([diff](<https://robloxgalaxy.wiki/index.php?title=${encodeURIComponent(name)}&diff=prev&oldid=${encodeURIComponent(revision.revid)}>))` : "")}`
        })
    })
}

async function logDiscord(content: unknown) {
    await fetch(process.env.WEBHOOK!, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: typeof content === "string" ? content : JSON.stringify(content)
        })
    })
}

bot.once(Events.ClientReady, async () => {

    console.log(`Logged in as ${bot.user!.tag}!`)
    bot.user?.setActivity("the upstream API", { type: Discord.ActivityType.Listening })
    const mwbot = await ketchuplib.initBot()

    const updater = await ketchupbot.main(mwbot, logChange, logDiscord, true)
})

bot.on("messageCreate", async (message) => {
    if (message.author.bot) return
    if (message.channel.id !== "1100079016372867122") return

    const args = message.content.trim().split(/ +/g)

    // only listen to messages that mention the bot at the start of the message
    if (!message.content.trim().startsWith(`<@!${bot.user!.id}>`) && !message.content.trim().startsWith(`<@${bot.user!.id}>`)) return

    // slice off the mention and get the content of the message
    const prompt = args.slice(1).join(" ").toString().trim()
    if (prompt === "") {
        message.reply(bot.application!.description!.toString())
        return
    }
 
    // check if the user has the correct role to use this feature
    if (!message.member?.roles.cache.has("913918092973842463")) {
        message.reply("This feature is currently in development. Please check back later!")
        return
    }

    // quick console log for monitoring
    console.log("prompt: " + prompt)

    const loadingpattern = [
        ".",
        "..",
        "...",
    ]

    // this variable is used to stop the loading animation
    let thinking = true

    // send the loading animation
    const balling = await message.reply(`Thinking${loadingpattern[2]}`)

    try {
        const api = fetch(process.env.GPTAPIURL || "http://localhost:3636/api/v1/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt
            })
        })

        api.then(async (res) => {
            if (!res.ok) {
                thinking = false
                message.reply("Something went wrong. Please try again later.\nDebug info:\n```Got status code from API: " + res.status + "```")
                console.error(api)
                return
            }
    
            const response = await res.json()
            thinking = false
    
            console.log(response.answer)
            const bingus = await balling.edit(`${response.answer}\n\nCompletion Tokens: ${response.tokens.completion_tokens}\nPrompt Tokens: ${response.tokens.prompt_tokens}\nTotal Tokens: ${response.tokens.total_tokens}\nStop Reason: ${response.stop_reason ?? "unknown"}\nGalaxyGPT - Work In Progress - Report any bugs to ${(await bot.users.fetch("296052363427315713")).tag}`)
    
            if ((bingus.channel as Discord.TextChannel).permissionsFor(bot.user!)?.has(Discord.PermissionFlagsBits.AddReactions) === false) return
            await bingus.react("926726958052671538")
            await bingus.react("926726956970569809")
    
            bingus.awaitReactions({ filter: (reaction: Discord.MessageReaction, user: Discord.User) => { return (user.id === message.author.id && (reaction.emoji.id === "926726958052671538" || reaction.emoji.id === "926726956970569809")) }, max: 1, time: 900000 }).then(async (collected) => {
                if (collected.first()?.emoji.id === "926726958052671538") {
                    // like
                    await bingus.reactions.removeAll()
                    message.channel.send(Discord.userMention(message.author.id) + " Thank you for your feedback!")
                } else if (collected.first()?.emoji.id === "926726956970569809") {
                    // dislike
                    await bingus.reactions.removeAll()
                    message.channel.send(`${Discord.userMention(message.author.id)} Thank you for your feedback!\nCan you tell me how I can improve?\nbtw this feature isnt ready yet`)
                }
                console.log("Collected" + collected.first()?.emoji.id)
            }).catch(async (err) => {
                await bingus.reactions.removeAll()
                console.error(err)
            })
        }).catch(async (err) => {
            console.error(err)
            message.reply(err.message)
        })

        const animation = setInterval(async () => {
            try {
                balling.edit(`Thinking${loadingpattern[0]}`)
                loadingpattern.push(loadingpattern.shift()!)
            } catch (err: any) {
                console.error(err)
                clearInterval(animation)
            }
        }, 500)

        api.finally(() => {
            clearInterval(animation)
        })

    } catch (err: any) {
        thinking = false;
        (await balling).edit("Something went wrong. Please try again later.\nDebug Info:\n```" + err.message + "```")
        console.error(err)
    }
})


bot.login(process.env.TOKEN!)

