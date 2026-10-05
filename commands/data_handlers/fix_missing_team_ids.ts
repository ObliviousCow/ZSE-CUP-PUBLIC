import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { fix_missing_team_ids, resultContent } from "../../shared/functions.js";

export default {
    data: new SlashCommandBuilder()
        .setName("fix_teamids")
        .setDescription("Naprawia graczy bez przypisanej drużyny"),

    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const result = await fix_missing_team_ids();
        await interaction.editReply({ content: resultContent(result).slice(0, 2000) });
    }
};