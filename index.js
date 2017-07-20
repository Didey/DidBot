const ytdl = require ('ytdl-core');
const Discord = require('discord.js');
const Jimp = require('jimp');
const cv = require('opencv');
const glob = require('glob');
const request = require('request').defaults({ encoding : null });
const client = new Discord.Client();
const fs = require('fs');
const gm = require('gm');
const path = require('path');

// ALL allowed exts need to be 4 characters to allow for playing of 4-length extensions, until I think of a better solution(if there is one).
const allowedExtensions = [".MP3", ".OGG", ".WAV", "FLAC", "MIDI", ".WMA", ".M4A"];
const allowedImageExtensions = [".PNG", ".JPG", "JPEG"];

const commandList = ["replay", "help", "trump", "play", "stop", "pause", "resume", "replaceface", "strike", "sebz", "clear"];
const faceList = glob.sync("faces/*.*");
const prefix = "?";
const streamVolume = 0.50;

let commands = { };
let lastStreamURLs = { };
let strikeList = { };

client.login("MzExNjAzMjI1Mjg1MzYxNjY0.DBV6Ig.Y-Nz-8vH6k79DjCLMn142UshNHU").then( (err) => {
	if(err) throw err;
	
	console.log("login success");
}).catch( (err) => {
	console.log(err);
});

client.on("debug", message => {
    console.log(message); 
});

client.on('message', (message) => {
       // Slice the first arg so we only get the arguments.
       let args = message.content.split(" ").slice(1);

	console.log('message');
	
	// If there are any attachments, check if they are playable audio files.
	if(message.attachments.first())
		checkToPlayAttachment(message);

	processCommands(message, args);

});

function processCommands(message, args)
{
	
    let commandCheck = message.content.toLowerCase();

    if(commandCheck.indexOf(' ') != -1)
	{
		let commandStr = commandCheck.substr(0, commandCheck.indexOf(' '));
		let funcName = commandStr.substr(1, commandStr.length);
		if(commandList.includes(funcName))
		{
			console.log(funcName)
			commands[funcName](message, args);
		}
	} 
	else 
	{
		let commandStr = commandCheck.substr(1, commandCheck.length);
		if(commandList.includes(commandStr))
		{
			commands[commandStr](message, args);
		}
	}
}

function checkToPlayAttachment(message)
{
	if(message.member.id == client.user.id)
		return;
	// Gets the URL of the attachment to check if it's an audio URL, and if it is, start a stream with it.
	let streamURL = message.attachments.first().url;
	console.log(streamURL);

	// Just double checking that the streamURL isn't undefined.
	if(streamURL)
	{
		// Checks if the stream is an audio stream.
		if(allowedExtensions.includes(streamURL.substr(streamURL.length - 4).toUpperCase()))
		{
			// Check if the person who uploaded the attachment is in a voice channel.
			if(message.member.voiceChannel) 
			{
				// Audio stream exists and member is in a channel, start the audio stream. 
				message.member.voiceChannel.join().then(connection => {
					let voiceDispatch = connection.playArbitraryInput(streamURL);
					voiceDispatch.setVolume(streamVolume);
					message.channel.send(`Now playing **${streamURL.split('/').pop()}** from **${message.author.username}**!`);
					message.delete(1000);
					lastStreamURLs[message.member.guild.id] = streamURL;
				}).catch(console.log);
			}
			else
			{
				// If the uploader is not in a voice channel, let them know.
				message.channel.send("You need to be in a voice channel to play an audio file.");
			}
		}
		else if(allowedImageExtensions.includes(streamURL.substr(streamURL.length - 4).toUpperCase()) && !message.member.bot)
		{
			if(message.member.bot) return;
			// Make this an array because replaceface assumes an array.
			let url = [streamURL];
			commands["replaceface"](message, url);
			return;
		}
	}
}

/*
*
*	Commands section.
*
*/

commands.help = function help(message, args)
{
	let reply = "```\nDideyBot version 0.0.1, prefix: " + prefix + "\n**COMMANDS**\n";
	for(i = 0; i < commandList.length; i++)
	{
		reply += commandList[i] + "\n";
	}
	message.channel.send(reply + "```");

}

commands.testfile = function testfile(message, args)
{
    console.log("UP");
    message.member.voiceChannel.join().then(connection => {
	let stream = fs.createReadStream("./banned.mp3");
	let voiceDispatch = connection.playStream(stream, { passes: 5});
	voiceDispatch.setVolume(streamVolume);
    }).catch(console.log);
}

commands.trump = function trump(message, args)
{
    // Doing voice requires being in a voice channel.
    // User not in a channel? Dont look at it.
	if(!message.guild) return; 
	
	// Nothing in the arguments section, return.
	if(!args[0]) 
	{
		message.channel.send("You need to specify something for Donald to say.");
		return;
	}

	// Creates the trump TTS url.
	let trumpURL = "http://api.jungle.horse/speak?v=trump&vol=1&s=";

	for(i = 0; i < args.length; i++) 
	{
		// Instead of spaces, ad %20 for a properly formed URl.
		trumpURL += args[i] + "%20";
	}

	// Member needs to be in channel, if not, berate them for it.
	if(message.member.voiceChannel) 
	{
		message.member.voiceChannel.join().then(connection => {
			let voiceDispatch = connection.playArbitraryInput(trumpURL);
			voiceDispatch.setVolume(streamVolume);
			lastStreamURLs[message.member.guild.id] = trumpURL;
		}).catch(console.log);
	}
	else
	{
		message.channel.send("You need to be in a voice channel to make Donald say something.");
	}
}

client.on("guildBanAdd", (guild, user) => {
    console.log("user got banned");
    for(var channel in guild.channels) {
	if(channel.type == "text") {
	    channel.sendMessage(`User ${user.username} has been banned from the server.`);
	    channel.sendMessage("http://i.imgur.com/q0lsbeX.png");
	    console.log("lol, should have sent message");
	}
    }
    
    if(guild.voiceConnection) {
	console.log("make one");
	let connection = guild.voiceConnection;
	let voiceDispatch = connection.playFile("./banned.mp3");
	voiceDispatch.setVolume(streamVolume);
    }
});

commands.replay = function replay(message, args)
{
	if(!message.guild) return;


	console.log(lastStreamURLs[message.member.guild.id]);
	if(lastStreamURLs[message.member.guild.id])
	{
		
		let lastURL = lastStreamURLs[message.member.guild.id];
		if(lastURL.includes("trump") || lastURL.includes("discord"))
		{
			message.member.voiceChannel.join().then(connection => {
				voiceDispatch = connection.playArbitraryInput(lastURL);
				voiceDispatch.setVolume(streamVolume);
			});
		}
		else
		{
			let args = [lastURL];
			commands["play"](message, args);
		}
		message.channel.send("Playing the last audio stream that was played...")
	}
	else
	{
		message.channel.send("There hasn't been something played on this server yet!");
	}	
}

commands.clear = function clear(message, args)
{
    message.channel.bulkDelete(parseInt(args[0]));
}

commands.replaceface = function replaceface(message, args)
{
	let imageFileName = args[0].split('/').pop();
	console.log(imageFileName);
	// Have to download the image, openCV can't work with an image buffer.
	request(args[0]).pipe(fs.createWriteStream(imageFileName)).on('finish', () => {
		// If it's not a PNG, we need to convert it for transparency to work.
		if(imageFileName.toUpperCase().substr(imageFileName.length - 3) === "PNG")
		{
			// It's PNG, supports RGBA, continue.
			handleFaces(message, imageFileName);
		}
		else 
		{
			// Convert the other image into PNG, perhaps inneficient for other formats that support transparency. Will deal with at a later date.
			gm(imageFileName).write(path.parse(imageFileName).name + ".png", (err) => {
				if(err) throw err;
				fs.unlink(imageFileName);
				// Changes the image file name to support it's new name.
				imageFileName = path.parse(imageFileName).name + ".png";
				handleFaces(message, imageFileName);
			});
		}
		
	})
}

function handleFaces(message, arg)
{
	cv.readImage(arg, function(err, im) {
			// When all object detection is done, not just after every one.
			im.detectObject(cv.FACE_CASCADE, {}, function(err, faces) {
				// Do all processing here, kinda annoying with the way async JS works, but I'll manage.
				let repImage = Jimp.read(arg).then( (image) => {
					let faceImagePromises = [];
					
					for(i = 0; i < faces.length; i++)
					{
						// Jimp.read returns a promise, so I can add all those to an array and wait for them all to be done later.
						faceImagePromises.push(Jimp.read(faceList[Math.floor(Math.random()*faceList.length)]));
					}

					// Process all the promises.
					Promise.all(faceImagePromises).then( arguments => {
						// arguments[x] is the image object, returned by the original Jimp.read() promise at that point in the array(not particularly concerned about order in this case, it's random anyway).
						for(x = 0; x < faceImagePromises.length; x++)
						{
							// Scales the random face to fit a detected face in the main picture.
							arguments[x].scaleToFit(faces[x]["width"] * 2, faces[x]["height"]);
							// Composites the image and not blit, blit ignores A in RGBA.
							image.composite(arguments[x], faces[x]["x"], faces[x]["y"]);
						}
					}).then( () => {
						image.write(arg, () => {
							// Send the file after all processing is done.
							message.channel.send({ files : [arg]}).then(() => {
								fs.unlink(arg);
							});								
						});
					}).catch( (err) => {
						message.channel.send("Some sort of error processing the image.");
						console.err(err);
					});
				});
			});
		})
}

commands.play = function play(message, args) 
{
	// Do the same checks on all voice commands.
	if(!message.guild) return; 

	// Can't play anything from no URL, drop the command.
	if(!args[0])
	{
		return message.channel.send("You need to put a URL to play from.");
	}

        if(!args[0].includes('youtube')) {
	        return message.channel.send("You can only play videos from YouTube.");
        }
    
	let ytdlStream = ytdl(args[0], {
		filter : 'audioonly',
	}).on('response', (response) => {
		if(response["statusCode"] != 200)
		{
			// There's an error with the request.
			message.channel.send("There was an error with the request, perhaps a malformed URL?");
			return;
		}	
	}).on('error', (err) => {
		console.log(err);
	});
	
	if(message.member.voiceChannel) 
	{
		message.member.voiceChannel.join().then(connection => {
			let voiceDispatch = connection.playStream(ytdlStream);
			voiceDispatch.setVolume(streamVolume);
			lastStreamURLs[message.member.guild.id] = args[0];
		}).catch(console.log);
	}
	else
	{
		message.channel.send("You need to be in a voice channel to play something.");
	}
	
}

commands.sebz = function sebz(message, args)
{
    let ytdlStream = ytdl("https://www.youtube.com/watch?v=Xy6DB1Z5AfU&feature=youtu.be", {
	filter: 'audioonly'
    }).on('response', response => {
	if(response["statusCode"] != 200)
	{
	    return message.channel.send("There was an error with youtube.");
	}
    }).on('error', err => {
	console.log(err);
    });
    if(message.member.voiceChannel)
    {
	message.member.voiceChannel.join().then(connection => {
	    let voiceDispatch = connection.playStream(ytdlStream);
	    voiceDispatch.setVolume(streamVolume);
	}).catch(console.log);
    }
    else
    {
	message.channel.send("You need to be in a voice channel to roast sebz.");
    }
}

commands.strike = function strike(message, args)
{

    if(!message.guild)
	return message.channel.send("You need to be in a voice channel to administer strikes, kid.");
    
    if(!args[0])
	return message.channel.send("You need to put a name to shame.");
    
    let id = args[0].substring(2, args[0].length - 1);
    
    if(!strikeList[id])
	strikeList[id] = 0;

    strikeList[id]++;

    console.log("STRKNUM " + strikeList[id]);
    let url;
 
    if(strikeList[id] == 1) {
	url = "https://www.youtube.com/watch?v=pOuSeiNirqs";	
    } else if(strikeList[id] == 2) {
	url = "https://www.youtube.com/watch?v=LmzNISONc7w";
    } else if(strikeList[id] == 3) {
	url = "https://www.youtube.com/watch?v=0Iuvu7ZCSx0&feature=youtu.be";
    }
    
    stream = ytdl(url, {
	filter : 'audioonly',
    }).on('error', err => {
	console.log(err);
    });

    if(message.member.voiceChannel)
    {
	message.member.voiceChannel.join().then(connection => {
	    let voiceDispatch = connection.playStream(stream);
	    voiceDispatch.setVolume(streamVolume);
	}).catch(console.log);
    }
    
    if(strikeList[message.member.id] == 3) {
	message.channel.send(`STRIKE 3, YOU ARE OUTTA HERE <@${id}>!`);
	strikeList[id] = 0;
    } else {
	message.channel.send(`STTTTTTTTTTTTTTTTTTTTTTTTTTRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRIIIIIIKE ${strikeList[id]}, <@${id}>!`);
    }
}

commands.stop = function stop(message, args)
{
	if(message.member.voiceChannel.connection)
	{
		message.channel.send("Stopping current audio stream.");
		message.member.voiceChannel.leave();
	}
}

commands.pause = function pause(message, args)
{
	if(message.member.voiceChannel.connection)
	{
		message.channel.send("Pausing current audio stream.");
		message.member.voiceChannel.connection.dispatcher.pause();
	}
}

commands.resume = function resume(message, args)
{	if(message.member.voiceChannel.connection)
	{
		message.channel.send("Resuming current audio stream.");
		message.member.voiceChannel.connection.dispatcher.resume();	
	}
}
