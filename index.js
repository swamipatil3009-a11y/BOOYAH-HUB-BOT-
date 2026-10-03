require('dotenv').config();
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');
const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, Events
} = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const PORT = process.env.PORT || 3000;
const MAX_TEAMS = 12;
const FILE = './registrations.json';

if (!TOKEN) {
  console.error('Missing DISCORD_TOKEN. Add it to your environment variables.');
  process.exit(1);
}

let registrations = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : [];
const save = () => fs.writeFileSync(FILE, JSON.stringify(registrations, null, 2));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const commands = [
  new SlashCommandBuilder().setName('setup-registration').setDescription('Post the BOOYAH HUB team registration panel.'),
  new SlashCommandBuilder().setName('registrations').setDescription('Show current registered teams.'),
  new SlashCommandBuilder().setName('reset-registrations').setDescription('Clear all registrations (staff use).')
].map(c => c.toJSON());

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
  console.log('Slash commands registered.');
}

function registrationEmbed() {
  return new EmbedBuilder()
    .setTitle('🔥 BOOYAH HUB DAILY SCRIM')
    .setDescription([
      '**Registration:** 6:00 PM IST',
      '**Scrim:** 9:00 PM IST',
      '**Slots:** 12 teams',
      '**Roster:** 4 main players + 1 substitute',
      '',
      'Click **Register Team** to submit your team.'
    ].join('\n'))
    .setFooter({ text: 'BOOYAH HUB • Daily Scrims' });
}

function registrationRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('register_team').setLabel('Register Team').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('view_slots').setLabel('View Slots').setStyle(ButtonStyle.Secondary)
  );
}

client.once(Events.ClientReady, async c => {
  console.log(`Logged in as ${c.user.tag}`);
  try { await registerCommands(); } catch (e) { console.error('Command registration failed:', e); }
});

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-registration') {
        await interaction.reply({ embeds: [registrationEmbed()], components: [registrationRow()] });
      }
      if (interaction.commandName === 'registrations') {
        if (!registrations.length) return interaction.reply('No teams registered yet.');
        const text = registrations.map(r => `**Slot ${r.slot} — ${r.teamName}**\nCaptain: ${r.captain}\nPlayers: ${r.players.join(', ')}\nSub: ${r.sub}`).join('\n\n');
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📋 Current Registrations').setDescription(text.slice(0, 3900))] });
      }
      if (interaction.commandName === 'reset-registrations') {
        registrations = []; save();
        await interaction.reply('✅ Registrations cleared.');
      }
      return;
    }

    if (interaction.isButton()) {
      if (interaction.customId === 'view_slots') {
        const lines = Array.from({ length: MAX_TEAMS }, (_, i) => {
          const r = registrations.find(x => x.slot === i + 1);
          return `**${i + 1}.** ${r ? r.teamName : '🟢 Available'}`;
        });
        return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎫 BOOYAH HUB Slots').setDescription(lines.join('\n'))], ephemeral: true });
      }
      if (interaction.customId === 'register_team') {
        if (registrations.length >= MAX_TEAMS) return interaction.reply({ content: '❌ All 12 slots are full.', ephemeral: true });
        const modal = new ModalBuilder().setCustomId('team_registration').setTitle(`Team Registration • Slot ${registrations.length + 1}`);
        const team = new TextInputBuilder().setCustomId('team_name').setLabel('Team name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
        const captain = new TextInputBuilder().setCustomId('captain').setLabel('Captain IGN').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40);
        const players = new TextInputBuilder().setCustomId('players').setLabel('4 main player IGNs (comma separated)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(200);
        const sub = new TextInputBuilder().setCustomId('sub').setLabel('Substitute IGN').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(40);
        modal.addComponents(
          new ActionRowBuilder().addComponents(team),
          new ActionRowBuilder().addComponents(captain),
          new ActionRowBuilder().addComponents(players),
          new ActionRowBuilder().addComponents(sub)
        );
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId === 'team_registration') {
      if (registrations.length >= MAX_TEAMS) return interaction.reply({ content: '❌ All 12 slots are full.', ephemeral: true });
      const teamName = interaction.fields.getTextInputValue('team_name').trim();
      const captain = interaction.fields.getTextInputValue('captain').trim();
      const players = interaction.fields.getTextInputValue('players').split(',').map(x => x.trim()).filter(Boolean);
      const sub = interaction.fields.getTextInputValue('sub').trim();
      if (players.length !== 4) return interaction.reply({ content: '❌ Enter exactly 4 main player IGNs, separated by commas.', ephemeral: true });
      if (!players.some(p => p.toLowerCase() === captain.toLowerCase())) return interaction.reply({ content: '❌ Captain IGN must be one of the 4 main players.', ephemeral: true });
      if (registrations.some(r => r.teamName.toLowerCase() === teamName.toLowerCase())) return interaction.reply({ content: '❌ That team name is already registered.', ephemeral: true });
      const slot = registrations.length + 1;
      registrations.push({ slot, teamName, captain, players, sub, discordUser: interaction.user.id, createdAt: new Date().toISOString() });
      save();
      return interaction.reply({ content: `✅ **${teamName}** registered successfully in **Slot ${slot}**!`, ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: 'Something went wrong. Please try again.', ephemeral: true });
  }
});

// Re-open registrations every day at 18:00 IST and clear yesterday's list.
cron.schedule('0 18 * * *', () => {
  registrations = [];
  save();
  console.log('Daily registration reset at 18:00 IST.');
}, { timezone: 'Asia/Kolkata' });

// Keep Render's web service alive/healthy.
const app = express();
app.get('/', (_req, res) => res.send('BOOYAH HUB bot is running.'));
app.get('/health', (_req, res) => res.json({ ok: true, bot: client.user?.tag || null }));
app.listen(PORT, () => console.log(`Health server listening on ${PORT}`));

client.login(TOKEN);
