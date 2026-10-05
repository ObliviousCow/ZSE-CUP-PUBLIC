import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType, EmbedBuilder, MessageFlags, SlashCommandBuilder } from "discord.js";
import { remove_player_from_team, sync_player_roles, findPlayer } from "../../shared/functions.js";

export default {
    data: new SlashCommandBuilder()
        .setName("abandon_team")
        .setDescription("Opuść swoją drużynę")
        .addStringOption(option => option
            .setName("reason")
            .setDescription("Powód dla którego chcesz opuścić drużynę")
            .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {

        // TODO: Fix abandon.ts
        if (1 == 1)
            return interaction.reply("Under maintenance.")

        const reason = interaction.options.getString("reason") ?? "nie podano";

        const reply = await interaction.reply({
            flags: MessageFlags.Ephemeral,
            embeds: [
                new EmbedBuilder()
                    .setTitle("Potwierdzenie")
                    .setDescription("Czy na pewno chcesz opuścić swoją drużynę?")
                    .setColor(0xfee75c)
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder().setLabel("Potwierdź").setEmoji("✅").setCustomId("abandon_true").setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setLabel("Anuluj").setEmoji("❌").setCustomId("abandon_false").setStyle(ButtonStyle.Secondary)
                )
            ]
        });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30_000,
            max: 1
        });

        collector.on("collect", async (i) => {
            if (i.customId !== "abandon_true")
                return await i.update({ content: "Anulowano!", embeds: [], components: [] });

            const player = await findPlayer(interaction.user.username);
            if (!player)
                return await i.update({ content: "Nie znaleziono Cię w bazie! Skontaktuj się z adminem.", embeds: [], components: [] });

            if (!player.data.teamId)
                return await i.update({ content: "Nie należysz do żadnej drużyny!", embeds: [], components: [] });

            const removeResult = await remove_player_from_team(interaction.user.username);
            if (removeResult.code === 1)
                return await i.update({ content: `❌ ${removeResult.message}`, embeds: [], components: [] });

            await sync_player_roles(interaction.guild!, interaction.user.username);

            await i.update({ content: `✅ Pomyślnie wypisano Cię z drużyny! Powód: ${reason}`, embeds: [], components: [] });

            const teamChannelId = player.data.teamId
                ? (await findPlayer(interaction.user.username))?.data.teamId
                : null;

            if (teamChannelId) {
                const teamChannel = await interaction.client.channels.fetch(teamChannelId).catch(() => null);
                if (teamChannel?.isSendable()) {
                    await teamChannel.send({
                        content: `Użytkownik **${interaction.user.username}** opuścił waszą drużynę! Powód: *${reason}.*`
                    });
                }
            }
        });

        collector.on("end", async (collected) => {
            if (collected.size === 0)
                await interaction.editReply({ content: "⏰ Czas na decyzję upłynął!", embeds: [], components: [] });
        });
    }
};