const sharp = require('sharp');
const path = require('path');
const utils = require('./utils.js');
const { rootPath } = require('./electronWindow.js');

/**
 * Scale and crop an image to 800x600
 * @param {string} inputPath - The path to the input image file
 * @param {string} outputPath - The path to the output image file
 */
async function scaleAndCrop(targetWidth, targetHeight, inputPath) {

    try {
        const image = sharp(inputPath);
        const metadata = await image.metadata();

        const widthRatio = targetWidth / metadata.width;
        const heightRatio = targetHeight / metadata.height;

        const scaleFactor = Math.max(widthRatio, heightRatio);
        const scaledWidth = Math.round(metadata.width * scaleFactor);
        const scaledHeight = Math.round(metadata.height * scaleFactor);
				
				const regexPath = /^.*[\\\/](.*?)(?:\.(\w*))?$/.exec(inputPath);
				//const regexPath = /^(.*?)(?:\.(\w*))?$/.exec(inputPath);
				//const outputPath = regexPath[1] + "-scaled." + (regexPath[2] ?? "png");
				const outputPath = rootPath+"/files/"+regexPath[1]+"-scaled."+regexPath[2];

        await image
            .resize(scaledWidth, scaledHeight)
            .extract({
                left: Math.round((scaledWidth - targetWidth) / 2),
                top: Math.round((scaledHeight - targetHeight) / 2),
                width: targetWidth,
                height: targetHeight,
            })
            .toFile(outputPath);

        console.log(`Image scaled and cropped to ${targetWidth}x${targetHeight} and saved to ${outputPath}`);
				return outputPath;
    } catch (error) {
        console.error('Error scaling and cropping image:', error);
				return;
    }
}


module.exports = { scaleAndCrop };