import { ButtonInteraction, EmbedBuilder, TextChannel } from 'discord.js';

export default async function (interaction: ButtonInteraction) {
    const { guild, user, message } = interaction;

    const ticketChannel = guild?.channels.cache.find(
        (ch) => ch.id === "1483144896482246749" && ch.isTextBased()
    ) as TextChannel | undefined;

    const severityLabel = message.embeds[0]?.title?.split("•")[1]?.trim() ?? "Unknown";
    const subject = message.embeds[0]?.fields?.find(f => f.name === "📌 Temat")?.value ?? "Unknown";

    const closedEmbed = EmbedBuilder.from(message.embeds[0])
        .setTitle(`🔒 Ticket Zamknięty • ${severityLabel}`)
        .setColor(0x808080)
        .setFooter({ text: `Zamknięty przez: ${user.tag} | Serwer: ${guild?.name}` })
        .setTimestamp();

    await interaction.update({ embeds: [closedEmbed], components: [] });

    if (ticketChannel) {
        const closedAdminEmbed = new EmbedBuilder()
            .setTitle(`🔒 Ticket Zamknięty • ${severityLabel}`)
            .setColor(0x808080)
            .addFields(
                { name: "📌 Temat", value: subject, inline: false },
                { name: "👤 Zgłaszający", value: message.content.match(/<@(\d+)>/)?.[0] ?? "Unknown", inline: true },
                { name: "🔒 Zamknięty przez", value: `<@${user.id}>`, inline: true },
                { name: "📢 Kanał", value: `${interaction.channel}`, inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `Serwer: ${guild?.name}` });

        await (ticketChannel as TextChannel).send({ embeds: [closedAdminEmbed] });
    }

    const channel = interaction.channel as TextChannel;
    if (channel && 'setName' in channel) {
        await channel.setName(`🔘 ${channel.name.split('・')[1] ?? channel.name}`);

        const ticketUserId = message.content.match(/<@(\d+)>/)?.[1];
        if (ticketUserId) {
            await channel.permissionOverwrites.edit(ticketUserId, {
                SendMessages: false,
                ReadMessageHistory: true,
                ViewChannel: true,
            });
        }
    }
}