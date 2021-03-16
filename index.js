// WEB SERVER
const express = require('express')
const server = express()
const port = process.env.PORT || 8000;
server.get('/', (req, res) => {res.send('K-Bot server running...')})
server.listen(port, () => {
    console.clear()
    console.log('\nWeb-server running!\n')
})

// LOAD Baileys
const {
    WAConnection,
    MessageType,
    Presence,
    Mimetype,
    GroupSettingChange,
    MessageOptions,
    WALocationMessage,
    WA_MESSAGE_STUB_TYPES,
    ReconnectMode,
    ProxyAgent,
    waChatKey,
    mentionedJid,
    processTime,
} = require('@adiwajshing/baileys')

// LOAD DB CONNECTION
const db = require('./database');

async function fetchauth() {
    try{
    auth_result = await db.query('select * from auth;');
    console.log('Fetching login data...')
    auth_row_count = await auth_result.rowCount;
    if (auth_row_count == 0) {
        console.log('No login data found!')
    } else {
        console.log('Login data found!')
        auth_obj = {
            clientID: auth_result.rows[0].clientid,
            serverToken: auth_result.rows[0].servertoken,
            clientToken: auth_result.rows[0].clienttoken,
            encKey: auth_result.rows[0].enckey,
            macKey: auth_result.rows[0].mackey
        }
    }
    } catch {
        console.log('Creating database...')
        await db.query('CREATE TABLE auth(clientID text, serverToken text, clientToken text, encKey text, macKey text);');
        await fetchauth();
    }

}

// BASIC SETTINGS
prefix = '/';
source_link = 'https://github.com/karmaisgreat/simple-whatsapp-bot';

// LOAD CUSTOM FUNCTIONS
const getGroupAdmins = (participants) => {
	admins = []
	for (let i of participants) {
		i.isAdmin ? admins.push(i.jid) : ''
	}
	return admins
}
const adminhelp = (prefix, groupName) => {
        return `
─「 *${groupName} Admin Commands* 」─

*${prefix}add <phone number>*
    _Add any new member!_

*${prefix}kick <@mention>*
    _Kick any member out from group!_
    _Alias with ${prefix}remove, ${prefix}ban_

*${prefix}promote <@mention>*
    _Give admin permission to a member!_

*${prefix}demote <@mention>*
    _Remove admin permission of a member!_

*${prefix}rename <new-subject>*
    _Change group subject!_

*${prefix}chat <on/off>*
    _Enable/disable group chat_
    _/chat on - for everyone!_
    _/chat off - for admin only!_

*${prefix}link*
    _Get group invite link!_
    _Alias with ${prefix}getlink, ${prefix}grouplink_

*${prefix}removebot*
    _Remove bot from group!_

*${prefix}source*
    _Get bot source code!_`
}

// MAIN FUNCTION
async function main() {

    // LOADING SESSION
    const conn = new WAConnection()
    conn.logger.level = 'warn'
    conn.on('qr', () => {console.log('SCAN THE ABOVE QR CODE TO LOGIN!')})
    await fetchauth(); //GET LOGIN DATA
    if (auth_row_count == 1) {conn.loadAuthInfo(auth_obj)}
    conn.on('connecting', () => {console.log('Connecting...')})
    conn.on('open', () => {
        console.clear()
        console.log('Connected!')
    })
    await conn.connect({timeoutMs: 30 * 1000})
    const authInfo = conn.base64EncodedAuthInfo() // UPDATED LOGIN DATA
    load_clientID = authInfo.clientID;
    load_serverToken = authInfo.serverToken;
    load_clientToken = authInfo.clientToken;
    load_encKey = authInfo.encKey;
    load_macKey = authInfo.macKey;
    // INSERT / UPDATE LOGIN DATA
    if (auth_row_count == 0) {
        console.log('Inserting login data...')
        db.query('INSERT INTO auth VALUES($1,$2,$3,$4,$5);',[load_clientID,load_serverToken,load_clientToken,load_encKey,load_macKey])
        db.query('commit;')
        console.log('New login data inserted!')
    } else {
        console.log('Updating login data....')
        db.query('UPDATE auth SET clientid = $1, servertoken = $2, clienttoken = $3, enckey = $4, mackey = $5;',[load_clientID,load_serverToken,load_clientToken,load_encKey,load_macKey])
        db.query('commit;')
        console.log('Login data updated!')
    }

    conn.on('chat-update', async (mek) => {
        try {
            if (!mek.hasNewMessage) return
            mek = JSON.parse(JSON.stringify(mek)).messages[0]
            if (!mek.message) return
            if (mek.key && mek.key.remoteJid == 'status@broadcast') return
            if (mek.key.fromMe) return
            global.prefix
            const from = mek.key.remoteJid
            const type = Object.keys(mek.message)[0]
            const {
                text,
                extendedText,
                contact,
                location,
                liveLocation,
                image,
                video,
                sticker,
                document,
                audio,
                product
            } = MessageType
            body = (type === 'conversation' && mek.message.conversation.startsWith(prefix)) ? mek.message.conversation : (type == 'imageMessage') && mek.message.imageMessage.caption.startsWith(prefix) ? mek.message.imageMessage.caption : (type == 'videoMessage') && mek.message.videoMessage.caption.startsWith(prefix) ? mek.message.videoMessage.caption : (type == 'extendedTextMessage') && mek.message.extendedTextMessage.text.startsWith(prefix) ? mek.message.extendedTextMessage.text : ''
            const command = body.slice(1).trim().split(/ +/).shift().toLowerCase()
            const args = body.trim().split(/ +/).slice(1)
            const isCmd = body.startsWith(prefix)

            errors = {
                admin_error: '_❌ ERROR: Admin permission failed! ❌_'
            }

            const botNumber = conn.user.jid
            const isGroup = from.endsWith('@g.us')
            const sender = isGroup ? mek.participant : mek.key.remoteJid
            const groupMetadata = isGroup ? await conn.groupMetadata(from) : ''
            const groupName = isGroup ? groupMetadata.subject : ''
            const groupMembers = isGroup ? groupMetadata.participants : ''
            const groupAdmins = isGroup ? getGroupAdmins(groupMembers) : ''
            const isBotGroupAdmins = groupAdmins.includes(botNumber) || false
            const isGroupAdmins = groupAdmins.includes(sender) || false

            const reply = (teks) => {
                conn.sendMessage(from, teks, text, {
                    quoted: mek
                })
            }

            const costum = (pesan, tipe, target, target2) => {
                conn.sendMessage(from, pesan, tipe, {
                    quoted: {
                        key: {
                            fromMe: false,
                            participant: `${target}`,
                            ...(from ? {
                                remoteJid: from
                            } : {})
                        },
                        message: {
                            conversation: `${target2}`
                        }
                    }
                })
            }

            if (isCmd && isGroup) console.log('[COMMAND]', command, '[FROM]', sender.split('@')[0], '[IN]', groupName)

            /////////////// COMMANDS \\\\\\\\\\\\\\\

            switch (command) {

                /////////////// HELP \\\\\\\\\\\\\\\

                case 'help':
                case 'acmd':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    await costum(adminhelp(prefix, groupName), text);
                    break

                case 'link':
                case 'getlink':
                case 'grouplink':
                    if (!isGroup) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    gc_invite_code = await conn.groupInviteCode(from)
                    gc_link = `https://chat.whatsapp.com/${gc_invite_code}`
                    conn.sendMessage(from, gc_link, text, {
                        quoted: mek,
                        detectLinks: true
                    })
                    break;

                case 'source':
                    if (!isGroup) return;
                    conn.sendMessage(from, source_link, text, {
                        quoted: mek,
                        detectLinks: true
                    })
                    break;

                /////////////// ADMIN COMMANDS \\\\\\\\\\\\\\\

                case 'add':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    try {
                        var num = '';
                        if (args.length > 1) {
                            for (let j = 0; j < args.length; j++) {
                                num = num + args[j]
                            }
                            num = `${num.replace(/ /g, '')}@s.whatsapp.net`
                        } else {
                            num = `${args[0].replace(/ /g, '')}@s.whatsapp.net`
                        }
                        if (num.startsWith('+')) {
                            num = `${num.split('+')[1]}`
                        }
                        const response = await conn.groupAdd(from, [num])
                        get_status = `${num.split('@s.whatsapp.net')[0]}`
                        get_status = response[`${get_status}@c.us`];
                        if (get_status == 200) {
                            return;
                        } else {
                            reply('_❌ ERROR: Failed to add member!, ❌_\n_Possible reasons:_ \n_[1] Incorrect Number._\n_[2] Person left the group._\n_[3] Privacy on adding groups!_');
                        }
                    } catch {
                        reply('_❌ ERROR: Failed to add member!, ❌_\n_Possible reasons:_ \n_[1] Incorrect Number._\n_[2] Person left the group._\n_[3] Privacy on adding groups!_');
                    }
                    break;

                case 'kick':
                case 'remove':
                case 'ban':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return;
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == true) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupRemove(from, mentioned)
                    }
                    break;

                case 'promote':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return;
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == true) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupMakeAdmin(from, mentioned)
                    }
                    break;

                case 'demote':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (mek.message.extendedTextMessage === undefined || mek.message.extendedTextMessage === null) return reply('_⚠ USAGE: /demote <@mention> ⚠_');
                    mentioned = mek.message.extendedTextMessage.contextInfo.mentionedJid
                    if (groupAdmins.includes(`${mentioned}`) == false) return;
                    if (mentioned.length > 1) {
                        return;
                    } else {
                        conn.groupDemoteAdmin(from, mentioned)
                    }
                    break;

                case 'chat':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    if (args[0] == 'on') {
                        conn.groupSettingChange(from, GroupSettingChange.messageSend, false);
                    } else if (args[0] == 'off') {
                        conn.groupSettingChange(from, GroupSettingChange.messageSend, true);
                    } else {
                        return;
                    }
                    break;

                case 'rename':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    if (!isBotGroupAdmins) return reply(errors.admin_error);
                    if (args.length < 1) return;
                    get_subject = '';
                    for (i = 0; i < args.length; i++) {
                        get_subject = get_subject + args[i] + ' ';
                    }
                    conn.groupUpdateSubject(from, get_subject);
                    break;

                case 'removebot':
                    if (!isGroup) return;
                    if (!isGroupAdmins) return;
                    conn.groupLeave(from)
                    break;

                default:
                    break;
            }
        } catch (e) {
            console.log('Error : %s', e)
        }
    })
}
main()