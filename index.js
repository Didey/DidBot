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

client.login(process.env.DISCORD_API_KEY);

// ALL allowed exts need to be 4 characters to allow for playing of 4-length extensions, until I think of a better solution(if there is one).
const allowedExtensions = [".MP3", ".OGG", ".WAV", "FLAC", "MIDI", ".WMA", ".M4A"];
const commandList = ["trump", "play", "stop", "pause", "resume", "replaceface"];
const faceList = glob.sync("faces/*.*");
const prefix = "?";
const streamVolume = 0.25;

client.on('message', (message) => {
	// Slice the first arg so we only get the arguments.
	let args = message.content.split(" ").slice(1);

	// If there are any attachments, check if they are playable audio files.
	if(message.attachments.first())
		checkToPlayAttachment(message);

	processCommands(message, args);

});

function processCommands(message, args)
{
	
	if(checkCommand(message, "trump"))
	{
		trump(message, args);
	}
	else if(checkCommand(message, "play")) 
	{
		play(message, args);
	}
	else if(checkCommand(message, "stop")) 
	{
		stop(message, args);
	}
	else if(checkCommand(message, "pause")) 
	{
		pause(message, args);
	}
	else if(checkCommand(message, "resume")) 
	{
		resume(message, args);
	} 
	else if(checkCommand(message, "help"))
	{
		help(message, args);
	}
	else if(checkCommand(message, "replaceface"))
	{
		replaceface(message, args);
	}
}

function checkCommand(message, command)
{
	return message.content.startsWith(prefix + command);
}

function checkToPlayAttachment(message)
{
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
				}).catch(console.log);
			}
			else
			{
				// If the uploader is not in a voice channel, let them know.
				message.channel.send("You need to be in a voice channel to play an audio file.");
			}
		}
	}
}

/*
*
*	Commands section.
*
*/

function help(message, args)
{
	let reply = "```\nDideyBot version 0.0.1, prefix: " + prefix + "\n**COMMANDS**\n";
	for(i = 0; i < commandList.length; i++)
	{
		reply += commandList[i] + "\n";
	}
	message.channel.send(reply + "```");

}

function trump(message, args)
{
	// Doing voice requires being in a voice channel. User not in a channel? Dont look at it.
	if(!message.guild) return; 
	
	// Nothing in the arguments section? Return. Don't waste our precious CPU cycles.
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
		}).catch(console.log);
	}
	else
	{
		message.channel.send("You need to be in a voice channel to make Donald say something.");
	}
}

function replaceface(message, args)
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
							arguments[x].scaleToFit(faces[x]["width"], faces[x]["height"]);
							// Composites the image and not blit, blit ignores A in RGBA.
							image.composite(arguments[x], faces[x]["x"], faces[x]["y"]);
						}
					}).then( () => {
						image.write(arg, () => {
							// Send the file after all processing is done.
							message.channel.send({ files : [arg]});								
						});
					}).catch( (err) => {
						message.channel.send("Some sort of error processing the image.");
						console.err(err);
					});
				});
			});
		})
}

function play(message, args) 
{
	// Do the same checks on all voice commands.
	if(!message.guild) return; 

	// Can't play anything from no URL, drop the command.
	if(!args[0])
	{
		return message.channel.send("You need to put a URL to play from.");
	}

	let ytdlStream = ytdl(args[0], {
		filter : 'audioonly',
	}).on("error", (error) => {
		message.channel.send("There was an error with the URL stream.");
		console.log(error);
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
		message.channel.send("You need to be in a voice channel to play something.");
	}
	
}

function stop(message, args)
{
	message.channel.send("Stopping current audio stream.");
	message.member.voiceChannel.leave();
}

function pause(message, args)
{
	if(	message.member.voiceChannel.connection )
	{
		message.channel.send("Pausing current audio stream.");
		message.member.voiceChannel.connection.dispatcher.pause();
	}
}

function resume(message, args)
{	if(	message.member.voiceChannel.connection )
	{
		message.channel.send("Resuming current audio stream.");
		message.member.voiceChannel.connection.dispatcher.resume();	
	}
}
