import { ModalSubmitInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { remove_team } from "../shared/functions.js";
import config from '../config.json' with { type: 'json' };

export default async function (interaction: ModalSubmitInteraction) {
    const reason    = interaction.fields.getTextInputValue('reject_reason');
    const message   = interaction.message;
    const embed     = message?.embeds[0];
    const guild     = interaction.guild!;

    const teamId    = embed?.fields.find(f => f.name === "Team ID")?.value ?? "";
    const teamName  = embed?.fields.find(f => f.name === "🏷️ Nazwa drużyny")?.value ?? "—";
    const submitter = embed?.fields.find(f => f.name === "👤 Zgłaszający")?.value ?? "—";

    if (teamId)
        await remove_team(guild, teamId, false);

    if (interaction.isFromMessage()) {
        await message?.edit({
            embeds: [
                EmbedBuilder.from(embed!)
                    .setColor(0xed4245)
                    .setTitle('❌ Odrzucone')
                    .addFields({ name: '💬 Powód odrzucenia', value: reason, inline: false })
                    .setFooter({ text: `🔨 Odrzucił: ${interaction.user.tag}` })
            ],
            components: []
        });
    }

    const logChannel = guild.channels.cache.get(config.LogsChannel) as TextChannel | undefined;
    if (logChannel) {
        await logChannel.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('📋 Zgłoszenie odrzucone')
                    .setColor(0xed4245)
                    .addFields(
                        { name: '🏷️ Drużyna',         value: teamName,                    inline: true  },
                        { name: '👤 Zgłaszający',      value: submitter,                   inline: true  },
                        { name: '🔨 Odrzucił',         value: `<@${interaction.user.id}>`, inline: true  },
                        { name: '💬 Powód odrzucenia', value: reason,                      inline: false },
                    )
                    .setTimestamp()
            ]
        });
    }
}