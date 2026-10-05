import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { db } from "../../shared/database.js";
import { formatTeamName } from "../../shared/functions.js";

export default {
    data: new SlashCommandBuilder()
        .setName("fix_orphan_roles")
        .setDescription("Usuwa role drużyn które nie istnieją w bazie danych"),

    async execute(interaction: ChatInputCommandInteraction) {
        // TODO: Fix orphan roles cmd
        if (1 == 1)
            return interaction.reply("Under maintenance.")

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guild = interaction.guild!;

        const teamsSnap = await db.collection("Drużyny").get();
        const validRoleIds = new Set(
            teamsSnap.docs.map(doc => doc.data().role_id as string).filter(Boolean)
        );
        const validRoleNames = new Set(
            teamsSnap.docs.map(doc => formatTeamName(doc.data().short, doc.data().name))
        );

        const orphanRoles = guild.roles.cache.filter(role =>
            (validRoleNames.has(role.name) || role.name.startsWith('「')) &&
            !validRoleIds.has(role.id)
        );

        if (orphanRoles.size === 0) {
            return interaction.editReply({ content: '✅ Brak ról do usunięcia.' });
        }

        const deleted: string[] = [];
        const failed: string[] = [];

        await Promise.all(orphanRoles.map(async role => {
            const result = await role.delete('fix_orphan_roles: brak odpowiadającej drużyny').catch(() => null);
            if (result) deleted.push(role.name);
            else failed.push(role.name);
        }));

        await interaction.editReply({
            content: [
                deleted.length > 0 ? `✅ Usunięto **${deleted.length}** ról:\n${deleted.map(r => `• ${r}`).join('\n')}` : '',
                failed.length > 0 ? `❌ Nie udało się usunąć:\n${failed.map(r => `• ${r}`).join('\n')}` : '',
            ].filter(Boolean).join('\n\n')
        });
    }
};