const http = require('http');

// Render Web Services require an HTTP port. This tiny health server keeps the
// Discord bot compatible with Render's free Web Service.
const PORT = Number(process.env.PORT) || 10000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('BOOYAH HUB bot is running.');
});
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Health server listening on port ${PORT}`);
});

const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) { console.error('Missing DISCORD_TOKEN. Add it to your environment variables.'); process.exit(1); }

const MAX_TEAMS = 12;
const OPEN_HOUR = 18; // 6 PM IST
const CLOSE_HOUR = 21; // 9 PM IST
const TZ = 'Asia/Kolkata';
let teams = [];
let panelChannelId = null;

function istHour() {
  return Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
}
function isOpen() {
  const h = istHour();
  return h >= OPEN_HOUR && h < CLOSE_HOUR;
}
function slotText() { return `Slot ${teams.length + 1}`; }
function panelEmbed() {
  const open = isOpen();
  return new EmbedBuilder()
    .setTitle('🔥 BOOYAH HUB DAILY SCRIM')
    .setDescription(`**Registration:** ${open ? '🟢 OPEN' : '🔴 CLOSED'}\n**Time:** 6:00 PM – 9:00 PM IST\n**Slots:** ${teams.length}/${MAX_TEAMS}`)
    .addFields({ name: 'How to register', value: 'Tap **Register Team** and enter your team details.' })
    .setFooter({ text: 'BOOYAH HUB • Daily Scrim' });
}
function panelRow() {
  return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('register_team').setLabel('Register Team').setStyle(ButtonStyle.Success));
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, c => console.log(`Logged in as ${c.user.tag}`));

client.on(Events.InteractionCreate, async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'setup-registration') {
        panelChannelId = interaction.channelId;
        await interaction.channel.send({ embeds: [panelEmbed()], components: [panelRow()] });
        return interaction.reply({ content: '✅ Registration panel posted.', ephemeral: true });
      }
      if (interaction.commandName === 'registration') {
        await interaction.deferReply({ ephemeral: true });
        if (!teams.length) return interaction.editReply({ content: '📋 No teams registered yet.' });
        const list = teams.map(t => `**${t.slot}. ${t.teamName}** — Captain: ${t.captain}`).join('\n');
        return interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📋 BOOYAH HUB Registrations').setDescription(list).addFields({ name: 'Total', value: `${teams.length}/${MAX_TEAMS}` })] });
      }
      if (interaction.commandName === 'reset-registration') {
        await interaction.deferReply({ ephemeral: true });
        teams = [];
        return interaction.editReply({ content: '🧹 Registrations reset. No teams registered yet.' });
      }
    }

    if (interaction.isButton() && interaction.customId === 'register_team') {
      if (!isOpen()) return interaction.reply({ content: '🔴 Registration is closed. Registration opens at 6:00 PM IST and closes at 9:00 PM IST.', ephemeral: true });
      if (teams.length >= MAX_TEAMS) return interaction.reply({ content: '❌ All 12 slots are already full.', ephemeral: true });
      const modal = new ModalBuilder().setCustomId('team_registration').setTitle(`Register Team • ${slotText()}`);
      const team = new TextInputBuilder().setCustomId('teamName').setLabel('Team name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
      const captain = new TextInputBuilder().setCustomId('captain').setLabel('Captain').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
      const players = new TextInputBuilder().setCustomId('players').setLabel('Players (4 main players)').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(300).setPlaceholder('Player 1, Player 2, Player 3, Player 4');
      const substitute = new TextInputBuilder().setCustomId('substitute').setLabel('Substitute').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
      modal.addComponents(new ActionRowBuilder().addComponents(team), new ActionRowBuilder().addComponents(captain), new ActionRowBuilder().addComponents(players), new ActionRowBuilder().addComponents(substitute));
      return interaction.showModal(modal);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'team_registration') {
      if (!isOpen()) return interaction.reply({ content: '🔴 Registration has closed.', ephemeral: true });
      if (teams.length >= MAX_TEAMS) return interaction.reply({ content: '❌ All 12 slots are already full.', ephemeral: true });
      const entry = { slot: teams.length + 1, teamName: interaction.fields.getTextInputValue('teamName').trim(), captain: interaction.fields.getTextInputValue('captain').trim(), players: interaction.fields.getTextInputValue('players').trim(), substitute: interaction.fields.getTextInputValue('substitute').trim() };
      teams.push(entry);
      await interaction.reply({ content: `✅ **${entry.teamName}** registered successfully as **Slot ${entry.slot}**!`, ephemeral: false });
      if (panelChannelId) {
        const ch = await client.channels.fetch(panelChannelId).catch(() => null);
        if (ch) await ch.send({ embeds: [new EmbedBuilder().setTitle(`🎟️ Slot ${entry.slot} Confirmed`).setDescription(`**${entry.teamName}** has been registered.`).addFields({ name: 'Captain', value: entry.captain }, { name: 'Teams filled', value: `${teams.length}/${MAX_TEAMS}` })] });
      }
    }
  } catch (e) { console.error(e); if (!interaction.replied && !interaction.deferred) await interaction.reply({ content: '⚠️ Something went wrong. Please try again.', ephemeral: true }); }
});

client.login(TOKEN);
