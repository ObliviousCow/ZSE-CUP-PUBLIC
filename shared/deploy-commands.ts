import { REST, Routes, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import config from '../config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const foldersPath = join(__dirname, '../commands');
const commandFolders = readdirSync(foldersPath);

console.log("Building commands from files...");

for (const folder of commandFolders) {
    const commandsPath = join(foldersPath, folder);
    const commandFiles = readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts'));

    for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = (await import(pathToFileURL(filePath).href)).default;

        if (command?.data && command?.execute) {
            console.log(file);
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

try {
    console.log(`Started refreshing ${commands.length} application (/) commands.`);
    console.log("Cleaning up global commands...");
    await rest.put(Routes.applicationCommands(config.client), { body: [] });
    const data = await rest.put(Routes.applicationGuildCommands(config.client, config.guild), { body: commands }) as any[];
    console.log(`Successfully reloaded ${data.length} application (/) commands.`);
} catch (error) {
    console.error(error);
}