import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export default async function (interaction: ButtonInteraction) {
    const modal = new ModalBuilder()
        .setCustomId('reg_reject_modal')
        .setTitle('Powód odrzucenia')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('reject_reason')
                    .setLabel('Powód')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );

    await interaction.showModal(modal);
    await interaction.editReply("Odrzucono.")
}