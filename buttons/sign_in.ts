import { MessageFlags, ButtonInteraction } from "discord.js";
import { sync_player_roles } from "../shared/functions.js";

export default async function (interaction: ButtonInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await sync_player_roles(interaction.guild!, interaction.user.username);
    await interaction.editReply({
        content: result.code === 0 || result.code === 2 ? `✅ ${result.message}` : `❌ ${result.message}`
    });
}