const mineflayer = require('mineflayer');
const vec3 = require('vec3')
const Item = require('prismarine-item')('1.19')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const GoalNearXZ = goals.GoalNearXZ;
const GoalXZ = goals.GoalXZ;
const letters = require('./letters').letters;

const PORT_NUMBER = 12345; // CHANGEME the port number of minecraft server
const BOT_USERNAME = "Steve"; // CHANGEME the in game name of the bot
const settings = {
    host: "localhost",
    port: PORT_NUMBER,
    username: BOT_USERNAME,
};

var mcData;
var movements;

const INVENTORY_SLOT_1 = 36;
const INVENTORY_SLOT_2 = 37;
const RANGE = 2;
const FACE_VECTOR = vec3(0, 1, 0);
const LETTER_HEIGHT = 9;
const SPACE_HEIGHT = 9;
const SPACE_WIDTH = 4;

var MAIN_BLOCK; // The block used to draw the text
var BACKGROUND_BLOCK; // The block used for the background of the text

// --- Makes the bot go close (within 2 blocks) to the XZ vec3 coordinates
async function gotoNearXZ(coordinates) {
	try {
		let goal = new GoalNearXZ(coordinates.x, coordinates.z, RANGE);
		await bot.pathfinder.goto(goal);
	} catch(e) {
		console.log(e);
	}
}

// --- Makes the bot go to the exact XZ vec3 coordinates
async function gotoExactXZ(coordinates) {
    try {
        let goal = new GoalXZ(coordinates.x, coordinates.z);
        await bot.pathfinder.goto(goal);
    } catch(e) {
        console.log(e);
    }
}

// --- Make the bot walk backwards from vec3 coordinates
async function moveBackwardsFrom(coordinates) {
    try {
        bot.lookAt(coordinates.offset(0, 0, 1));
        while (bot.entity.position.distanceTo(coordinates) < 2) {
            bot.setControlState('back', true);
            await bot.waitForTicks(1);
        }
        bot.setControlState('back', false);
    } catch(e) {
        console.log(e);
    }
}

// --- Returns whether or not the two positions are within 1 block of XZ vec3 coordinates
function areEqualXZPositions(position1, position2) {
    return (Math.abs(position1.x - position2.x) < 1) && (Math.abs(position1.z == position2.z) < 1);
}

// --- Sets the main block and the background that the bot will use
async function setBlocks(mainBlock, backgroundBlock) {
    MAIN_BLOCK = await getBlock(mainBlock);
    if (!MAIN_BLOCK) return false;
    await bot.creative.setInventorySlot(INVENTORY_SLOT_1, new Item(MAIN_BLOCK, 1));
    if (backgroundBlock) {
        BACKGROUND_BLOCK = await getBlock(backgroundBlock);
        if (!BACKGROUND_BLOCK) return false;
        await bot.creative.setInventorySlot(INVENTORY_SLOT_2, new Item(BACKGROUND_BLOCK, 1));
    }
    return true;
}

// --- Give name of a block as a string returns the mcData blocks id
async function getBlock(block) {
    try {
        return mcData.itemsByName[block].id;
    } catch(e) {
        bot.chat(`Failed, specified block does not exist: ${block}`);
        console.log(`Failed, specified block does not exist: ${block}`);
        return null;
    }
}

// --- Makes the bot place a specified block at the specified vec3 referce position
async function placeBlock(block, referenceBlockPosition) {
    if (block == "MAIN") {
        await bot.equip(MAIN_BLOCK, "hand");
    }
    else {
        await bot.equip(BACKGROUND_BLOCK, "hand");
    }
    if (bot.entity.position.distanceTo(referenceBlockPosition) > 3) {
        await gotoNearXZ(referenceBlockPosition);
    }
    if (areEqualXZPositions(bot.entity.position, referenceBlockPosition.offset(0, 1, 0))) {
        await moveBackwardsFrom(referenceBlockPosition);
    }
    let referenceBlock = bot.blockAt(referenceBlockPosition);
    await bot.placeBlock(referenceBlock, FACE_VECTOR);
}

// --- Assuming that the bot is holding a background block, makes the bot place a background 
// --- block at the specified vec3 reference position
async function placeBackground(referenceBlockPosition) {
    if (bot.entity.position.distanceTo(referenceBlockPosition) > 3) {
        await gotoNearXZ(referenceBlockPosition);
    }
    if (areEqualXZPositions(bot.entity.position, referenceBlockPosition.offset(0, 1, 0))) {
        await moveBackwardsFrom(referenceBlockPosition);
    }
    let referenceBlock = bot.blockAt(referenceBlockPosition);
    await bot.placeBlock(referenceBlock, FACE_VECTOR);
}

// --- Makes the bot draw a space starting at the specified vec3 position, the space is filled
// --- with the background block when specified to do so. Used for space between words
async function drawSpace(position, fillBackground) {
    if (!fillBackground) return;
    let referenceBlockPosition = null;
    await bot.equip(BACKGROUND_BLOCK, "hand");
    for (var j = 0; j < SPACE_WIDTH; ++j) {
        if (j % 2 == 0) {
            for (var i = 0; i < SPACE_HEIGHT; ++i) {
                referenceBlockPosition = position.offset(i, -1, -j);
                await placeBackground(referenceBlockPosition);
            }
        }
        else {
            for (var i = SPACE_HEIGHT - 1; i >= 0; --i) {
                referenceBlockPosition = position.offset(i, -1, -j);
                await placeBackground(referenceBlockPosition);
            }
        }
    }
}

// --- Makes the bot draw a one line space starting at the specified vec3 position, the 
// --- space is filled with the background block when specified to do so. Used for space between 
// --- letters
async function drawLineSpace(position, fillBackground) {
    if (!fillBackground) return;
    let referenceBlockPosition = null;
    await bot.equip(BACKGROUND_BLOCK, "hand");
    for (var i = 0; i < SPACE_HEIGHT; ++i) {
        referenceBlockPosition = position.offset(i, -1, 0);
        await placeBackground(referenceBlockPosition);
    }
}

// --- Makes the bot draw a specificed letters starting at the specified vec3 position.
// --- Returns the width in blocks of the drawn letter. 
async function drawLetter(letter, position, fillBackground) {
    let letterArr = letters[letter];
    let referenceBlockPosition = null;
    let letterWidth = letterArr[0].length
    for (var j = 0; j < letterWidth; ++j) {
        // in a zig zag
        if (j % 2 == 0) {
            for (var i = LETTER_HEIGHT - 1; i >= 0; --i) {
                referenceBlockPosition = position.offset(i, -1, -j);
                if (letterArr[i][j] == "O") {
                    await placeBlock("MAIN", referenceBlockPosition);
                }
                else if (fillBackground) {
                    await placeBlock("BACKGROUND", referenceBlockPosition);
                }
            }
        }
        else {
            for (var i = 0; i < LETTER_HEIGHT; ++i) {
                referenceBlockPosition = position.offset(i, -1, -j);
                if (letterArr[i][j] == "O") {
                    await placeBlock("MAIN", referenceBlockPosition);
                }
                else if (fillBackground) {
                    await placeBlock("BACKGROUND", referenceBlockPosition);
                }
            }
        }
    }
    return letterWidth;
}

// --- Makes the bot draw the specified text
async function draw(text) {
    console.log(`${BOT_USERNAME} started drawing ${text}`);
    await bot.equip(MAIN_BLOCK, "hand");
    let startPosition = bot.entity.position;
    let nextPosition = startPosition.offset(-4, 0, 0);
    let fillBackground = BACKGROUND_BLOCK != null;
    for (let letter of text) {
        if (letter == " ") {
            await drawSpace(nextPosition, fillBackground);
            nextPosition = nextPosition.offset(0, 0, -4);
        }
        else {
            await drawLineSpace(nextPosition, fillBackground);
            nextPosition = nextPosition.offset(0, 0, -1);
            let letterWidth = await drawLetter(letter, nextPosition, fillBackground);
            nextPosition = nextPosition.offset(0, 0, -1 * letterWidth);
        }
    }
    await drawLineSpace(nextPosition, fillBackground);
    await gotoExactXZ(nextPosition.offset(4, 0, -1));
    bot.chat(`Done drawing ${text}`);
    console.log(`Done drawing ${text}`);
}

// -- bot constructor (called immediately after bot is created)
const bot = mineflayer.createBot(settings);
bot.once("spawn", () => {
    console.log(`${BOT_USERNAME} spawned`);
    bot.loadPlugin(pathfinder);
    mcData = require('minecraft-data')(bot.version);
	movements = new Movements(bot, mcData);
	bot.pathfinder.setMovements(movements);
	movements.canDig = false;
    MAIN_BLOCK = null;
    BACKGROUND_BLOCK = null;
});

// --- bot event listeners
bot.on("death", () => console.log(`${BOT_USERNAME} died!`));
bot.on("kicked", (reason, loggedIn) => console.log(reason, loggedIn));
bot.on("error", err => console.log(err));

// --- Main function that listens for the main command, bot command listener
bot.on("chat", async (username, message) => {
	if (username == BOT_USERNAME) return;

	let tokens = message.split(" ");
    
	if (tokens[0] == "drawLetters") {
        console.log(`tokens: ${tokens.toString()}`)
        let blocks = tokens[1].split(",");
        if (blocks.length > 2) {
            bot.chat(`Failed, invalid argument for blocks`);
            console.log(`Failed, invalid argument for blocks`);
            return;
        }
        let mainBlock = blocks[0];
        let backgroundBlock = (blocks.length == 2) ? blocks[1] : null;
        if (!(await setBlocks(mainBlock, backgroundBlock))) {
            return;
        }
        let text = tokens[2];
        if (tokens.length > 3) {
            text = tokens.slice(2, tokens.length + 1).join(" ");
        } 
        await draw(text);
	}
});