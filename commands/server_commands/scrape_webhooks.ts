import { ChatInputCommandInteraction, Guild, Message, MessageFlags, SlashCommandBuilder, TextChannel } from "discord.js";
import { generateAcceptance } from "../../shared/functions";

export default {
    data: new SlashCommandBuilder()
        .setName("scrape_wh")
        .setDescription("Zbiera pominięte webhooki i tworzy embedy"),
    async execute(interaction: ChatInputCommandInteraction) {
        if (1 == 1)
            return interaction.reply("Under maintenance.")
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const ChannelId = "1485267524411985930"

        const TextChannel = await interaction.guild!.channels.fetch(ChannelId) as TextChannel | undefined
        if (!TextChannel)
            return await interaction.editReply(`Błąd fetchowania kanału`)

        const messagesSet = await TextChannel.messages.fetch({
            limit: 30,
            cache: false
        })

        const messagesProcessed = [] as string[];

        const whMessages = messagesSet.filter(message => message.author.id == "1485267565360975923");


        whMessages.forEach(message => {
            generateAcceptance(message);
            const field = message.embeds[1]?.fields.find(
                field => field.name == "🏷️ Nazwa drużyny"
            );
            if (field)
                messagesProcessed.push(field.name)
            else
                messagesProcessed.push(`Brak kontentu EMBED dla wiadomości **${message.id}**`)
        })

        interaction.editReply(`
                Zaktualizowano: ${messagesProcessed.length} wiadomości
                Array: ${messagesProcessed.toString()}
            `)
    }
}