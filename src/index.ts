import dotenv from "dotenv"
dotenv.config()

import { SapphireClient, Events } from "@sapphire/framework"
import { GatewayIntentBits } from "discord.js"
import * as ketchuplib from "./ketchupbot"
import fetch from "node-fetch"
//import * as cron from "node-cron"
import * as Discord from "discord.js"
import axios, { AxiosError } from "axios"

//const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const bot = new SapphireClient({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildWebhooks] })
export const ketchupbot = new ketchuplib.ShipUpdater()

async function logChange(name: string, revision: { revid: string | number } | null) {
    return axios.post(
        process.env.WEBHOOK!,
        JSON.stringify({
            content: `Updated **${name}**! ${(revision ? `([diff](<https://robloxgalaxy.wiki/index.php?title=${encodeURIComponent(name)}&diff=prev&oldid=${encodeURIComponent(revision.revid)}>))` : "")}`
        }),
        { headers: { "Content-Type": "application/json" } }
        )
}

async function logDiscord(content: unknown): Promise<void> {
    await axios.post(
        process.env.WEBHOOK!,
        JSON.stringify({
            content: typeof content === "string" ? content : JSON.stringify(content)
        }),
        { headers: { "Content-Type": "application/json" } }
    )
}

bot.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${bot.user!.tag}!`)
    bot.user?.setActivity("the upstream API", { type: Discord.ActivityType.Listening })
    const mwbot = await ketchuplib.initBot()

    const updater = await ketchupbot.main(mwbot, logChange, logDiscord, true)
})

// GalaxyGPT Module
bot.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return

    const args = message.content.trim().split(/ +/g)

    // only listen to messages that mention the bot at the start of the message
    if (!message.content.trim().startsWith(`<@!${bot.user!.id}>`) && !message.content.trim().startsWith(`<@${bot.user!.id}>`)) return
    // only run in the testing channel
    if (message.channel.id !== "1100079016372867122") {
        try {
            message.delete()
        } catch (e) {
            console.error(e)
        }
        return
    }

    // slice off the mention and get the content of the message
    const prompt = args.slice(1).join(" ").toString().trim()
    console.log(prompt + " - " + message.author.username)

    // check if the prompt is too long
    if (prompt.length > 750) {
        message.reply("Your question is too long! Please keep it under 500 characters.")
        return
    }

    // check if the prompt is empty
    if (prompt === "") {
        message.reply("Hello! I'm KetchupBot. The official Galaxypedia Assistant & Automatic Updater!\n\nUpdates ships every hour at XX:00\nUpdates turrets page every hour at XX:30\nMore information can be found here: <https://robloxgalaxy.wiki/wiki/User:Ketchupbot101>\n\nReport any unintended behaviour to Galaxypedia Head Staff immediately\n<https://discord.robloxgalaxy.wiki>")
        return
    }

    // quick console log for monitoring
    console.log("prompt: " + prompt)

    const loadingpattern = [
        ".",
        "..",
        "...",
    ]

    // send the loading animation
    const balling = await message.reply(`Thinking${loadingpattern[2]}`)

    try {
        const api = axios.post(process.env.GPTAPIURL || "http://localhost:3636/api/v1/ask", {
            prompt: prompt,
            username: message.author.username
            }, {
                headers: { "Content-Type": "application/json" }
            })

        api.then(async (res) => {

            interface Response {
                answer: string,
                context: string | null,
                tokens: {
                    completion_tokens: number
                    prompt_tokens: number
                    total_tokens: number
                } | null,
                embeddings_usage: {
                    prompt_tokens: number,
                    total_tokens: number
                } | null,
                stop_reason: string | null,
                dataset: string | null,
                version: string
            }

            if (!res.data) {
                message.reply("Something went wrong. Please try again later.\nDebug info:\n```Got status code from API: " + res.status + "```")
                return
            }

            const response: Response = res.data

            console.log(response.answer)

            let bingus: Discord.Message
            if (response.tokens && response.embeddings_usage) {
                const totalchatcost = parseFloat((((response.tokens.prompt_tokens / 1000) * 0.0005) + ((response.tokens.completion_tokens / 1000) * 0.0015)).toFixed(8))
                const totalembeddingscost = parseFloat(((response.embeddings_usage.total_tokens / 1000) * 0.00002).toFixed(8))
                const totalcost = parseFloat((totalchatcost + totalembeddingscost).toFixed(8))
                console.log("Context: ", response.context ?? "Unknown")
                const contexttxt = Buffer.from(response.context ?? "Unknown", "utf8")
                bingus = await balling.edit({ content: `${response.answer}\n\n### ChatGPT\nCompletion Tokens: ${response.tokens.completion_tokens ?? "Unknown"}\nPrompt Tokens: ${response.tokens.prompt_tokens ?? "Unknown"}\nTotal Tokens: ${response.tokens.total_tokens ?? "Unknown"} (USD $${totalchatcost})\n### Embeddings\nPrompt Tokens: ${response.embeddings_usage.prompt_tokens ?? "Unknown"}\nTotal Tokens: ${response.embeddings_usage.total_tokens ?? "Unknown"} (USD $${totalembeddingscost})\n### Debugging\nTotal Tokens Used: ${response.tokens.total_tokens + response.embeddings_usage.total_tokens ?? "Unknown"} (USD $${totalcost})\nStop Reason: ${response.stop_reason ?? "Unknown"}\nGalaxyGPT v${response.version} ${response.dataset ? response.dataset.toString() : ""}`, files: [{ name: "context.txt", attachment: contexttxt }] })
            } else {
                bingus = await balling.edit({ content: `${response.answer}\nGalaxyGPT v${response.version} ${response.dataset ? response.dataset.toString() : ""}` })
            }

            /*             if ((bingus.channel as Discord.TextChannel).permissionsFor(bot.user!)?.has(Discord.PermissionFlagsBits.AddReactions) === false) return
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
                        }) */
        }).catch(async (error: AxiosError) => {
            await message.reply("Something went wrong. Please try again later.\nDebug info:\n```Got status code from API: " + error.response?.status + "```\nCheck the console for more info.")

            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.log(error.response.data);
                console.log(error.response.status);
                console.log(error.response.headers);
              } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(error.request);
              } else {
                // Something happened in setting up the request that triggered an Error
                console.log('Error', error.message);
              }
              console.log(error.config);
        })

        const animation = setInterval(async () => {
            try {
                await balling.edit(`Thinking${loadingpattern[0]}`)
                loadingpattern.push(loadingpattern.shift()!)
            } catch (err: any) {
                console.error(err)
                clearInterval(animation)
            }
        }, 1000)

        api.finally(() => {
            clearInterval(animation)
        })

    } catch (err: any) {
        balling.edit("Something went wrong. Please try again later.\nDebug Info:\n```" + err.message + "```")
        console.error(err)
    }
})


bot.login(process.env.TOKEN!)