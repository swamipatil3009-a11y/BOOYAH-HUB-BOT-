const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (_req,res)=>res.status(200).send('BOOYAH HUB bot is running.'));
app.listen(PORT,'0.0.0.0',()=>console.log(`Web server listening on ${PORT}`));
const token=process.env.DISCORD_TOKEN;
if(!token){console.error('Missing DISCORD_TOKEN. Add it to your environment variables.');process.exit(1)}
const client=new Client({intents:[GatewayIntentBits.Guilds]});
const registrations=new Map();
const commands=[
 new SlashCommandBuilder().setName('setup-registration').setDescription('Post the BOOYAH Hub team registration panel'),
 new SlashCommandBuilder().setName('registration').setDescription('Show current team registrations'),
 new SlashCommandBuilder().setName('reset-registration').setDescription('Reset all current registrations')
].map(c=>c.toJSON());
client.once('ready',async()=>{console.log(`Logged in as ${client.user.tag}`);try{const rest=new REST({version:'10'}).setToken(token);await rest.put(Routes.applicationCommands(client.user.id),{body:commands});console.log('Slash commands registered.')}catch(e){console.error('Slash command registration failed:',e)}});
function isOpen(){const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit',hour12:false}).formatToParts(new Date());const h=Number(p.find(x=>x.type==='hour').value),m=Number(p.find(x=>x.type==='minute').value);const n=h*60+m;return n>=1080&&n<1260}
function list(){if(!registrations.size)return 'No teams registered yet.';return [...registrations.entries()].map(([s,r])=>`**Slot ${s} — ${r.team}**\nCaptain: ${r.captain}\nPlayers: ${r.players}\nSubstitute: ${r.substitute}`).join('\n\n')}
client.on('interactionCreate',async i=>{try{
 if(i.isChatInputCommand()){
  if(i.commandName==='setup-registration'){
   const taken=new Set(registrations.keys());
   const slots=Array.from({length:12},(_,idx)=>{const n=idx+1;return `${taken.has(n)?'🟥':'🟩'} Slot ${n}${taken.has(n)?' — Taken':' — Available'}`}).join('\n');
   const remaining=12-registrations.size;
   const e=new EmbedBuilder()
     .setTitle('🔥 BOOYAH HUB DAILY SCRIM')
     .setDescription(`Registration: **6:00 PM–9:00 PM IST**\nTeams: **${registrations.size}/12** • **${remaining} slots remaining**\n\n**SLOT STATUS**\n${slots}\n\nClick **Register Team** to enter.`)
     .setColor(0xF5A623);
   const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('register_team').setLabel('Register Team').setStyle(ButtonStyle.Primary));
   await i.reply({embeds:[e],components:[row]});return}
  if(i.commandName==='registration'){await i.reply({content:list(),ephemeral:true});return}
  if(i.commandName==='reset-registration'){registrations.clear();await i.reply({content:'✅ Registration has been reset.',ephemeral:true});return}
 }
 if(i.isButton()&&i.customId==='register_team'){if(!isOpen()){await i.reply({content:'⛔ Registration is now closed. Registration is open from 6:00 PM to 9:00 PM IST.',ephemeral:true});return}if(registrations.size>=12){await i.reply({content:'⛔ All 12 slots are full.',ephemeral:true});return}const m=new ModalBuilder().setCustomId('team_registration_modal').setTitle('BOOYAH HUB Team Registration');const f=(id,label,style=TextInputStyle.Short)=>new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(true);m.addComponents(new ActionRowBuilder().addComponents(f('team','Team name')),new ActionRowBuilder().addComponents(f('captain','Captain')),new ActionRowBuilder().addComponents(f('players','Players (4 main)',TextInputStyle.Paragraph)),new ActionRowBuilder().addComponents(f('substitute','Substitute')));await i.showModal(m);return}
 if(i.isModalSubmit()&&i.customId==='team_registration_modal'){if(!isOpen()){await i.reply({content:'⛔ Registration is closed.',ephemeral:true});return}if(registrations.size>=12){await i.reply({content:'⛔ All 12 slots are full.',ephemeral:true});return}const slot=Math.max(0,...registrations.keys())+1;const r={team:i.fields.getTextInputValue('team'),captain:i.fields.getTextInputValue('captain'),players:i.fields.getTextInputValue('players'),substitute:i.fields.getTextInputValue('substitute')};registrations.set(slot,r);await i.reply({content:`✅ **${r.team}** registered successfully as **Slot ${slot}**.`,ephemeral:true});}
}catch(e){console.error('Interaction error:',e);if(!i.replied&&!i.deferred)await i.reply({content:'⚠️ Something went wrong. Please try again.',ephemeral:true}).catch(()=>{})}});
client.login(token).catch(e=>{console.error('Discord login failed:',e);process.exit(1)});
