import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from "discord.js";
import { verify_team } from "../shared/functions.js";

const processingTeams = new Set<string>();

const buildRegButtons = (disabled: boolean) => new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('reg_accept').setLabel('✅ Zatwierdź').setStyle(ButtonStyle.Success).setDisabled(disabled),
    new ButtonBuilder().setCustomId('reg_reject').setLabel('❌ Odrzuć').setStyle(ButtonStyle.Danger).setDisabled(disabled),
);

export default async function (interaction: ButtonInteraction) {
    const embed = interaction.message.embeds[0];
    if (!embed) return;

    const teamId = embed.fields.find(f => f.name === "Team ID")?.value ?? "";

    if (!teamId) {
        await interaction.update({
            embeds: [EmbedBuilder.from(embed).setColor(0xed4245).setTitle('❌ Błąd').setFooter({ text: 'Brak Team ID w embedzie' })],
            components: []
        });
        return;
    }

    if (processingTeams.has(teamId)) {
        await interaction.reply({ content: '⏳ Zgłoszenie jest już przetwarzane...', flags: MessageFlags.Ephemeral });
        return;
    }

    await interaction.update({ components: [buildRegButtons(true)] });
    processingTeams.add(teamId);

    const result = await verify_team(interaction.guild!, teamId);
    processingTeams.delete(teamId);

    await interaction.message.edit({
        embeds: [
            EmbedBuilder.from(embed)
                .setColor(result.code === 0 ? 0x57f287 : 0xed4245)
                .setTitle(result.code === 0 ? '✅ Zatwierdzone' : '❌ Błąd')
                .setFooter({ text: `${result.code === 0 ? 'Zatwierdził' : 'Błąd'}: ${interaction.user.tag} — ${result.message}` })
        ],
        components: result.code === 0 ? [] : [buildRegButtons(false)]
    });
}