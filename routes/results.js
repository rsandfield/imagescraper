var express = require('express');
var cheerio = require('cheerio');
var axios = require("axios");
var router = express.Router();

/**
 * Converts Wikipedia title to article link
 * @param {String} title 
 * @returns 
 */
function titleToLink(title)
{
    title = title.replace(' ', '_');
    return "https://en.wikipedia.org/wiki/" + title;
}

/**
 * Converts Wikipedia link to article title
 * @param {String} link 
 * @returns 
 */
function linkToTitle(link)
{
    link = link.substring(link.lastIndexOf('/') + 1);
    return link.replace('_', ' ');
}

/**
 * Fetches page as DOM loaded into Cheerio
 * @param {string} url 
 * @returns cheerio object loaded with page DOM
 */
async function fetchHTML(url) {
    try{
        let {data} = await axios.get(url);
        return cheerio.load(data);
    }
    catch(e)
    {
        return cheerio.load({});
    }
}

/**
 * Fetches up to all image content from a linked Wikipedia article, can be
 * limited by providing a 'count' value for number of desired images
 * @param {string} link 
 * @param {number} count 
 * @returns Promise to deliver all images
 */
async function getImagesFromPage(link, count = Infinity)
{
    // Get the DOM for the linked page
    return fetchHTML(link)
        .then($ => {
            // Get content block of page
            let body = ($('#content')[0]);
            // Get all link nodes from page
            let linkNodes = $('a');
            // Return array and index iterator
            let images = [];
            let j = 0;
            //Iterate through all links
            for(let i = 0; i < linkNodes.length; i++)
            {
                // Extract node object from cheeriojs function
                let node = linkNodes[i];
                
                // Check that link node is a content image
                if
                ( 
                    // Link node is within body
                    $.contains(body, node)
                    // Link node contains image node
                    && node.attribs.class && node.attribs.class.localeCompare('image') == 0 
                    // Parent node is of type only used for content
                    && node.parent.attribs.class
                    && (
                        node.parent.attribs.class.localeCompare('thumbinner') == 0 ||
                        node.parent.attribs.class.localeCompare('infobox-image') == 0
                    )
                    // Image is not an SVG
                    && node.attribs.href.substr(node.attribs.href.lastIndexOf(".") + 1).localeCompare("svg") != 0
                )
                {
                    // Extract dedicated image page linked from Wikipedia article
                    let imagePage = ('https://en.wikipedia.org' + node.attribs.href);

                    // Assign a Promise to an array of image data Promises
                    images[j++] = fetchHTML(imagePage).then($$ => {
                        // Get the title of the image
                        let title = $$('title')[0].children[0].data;

                        // Initialize image object with URL and title
                        let image = {
                            url: imagePage,
                            title: title.substr(5, title.lastIndexOf(".") - 5),
                        }

                        // Check if the image is presented with a preview resolution
                        let preview = $$('.mw-filepage-resolutioninfo').children('a');
                        if(preview.length > 0)
                        {
                            // Get the image data for the reduced preview image
                            image.base64 = getBase64("https:" + preview[0].attribs.href);
                        }
                        else
                        {
                            // Get the image data for the full size image
                            image.base64 = getBase64("https:" + $$('#file')[0].children[0].attribs.href);
                        }

                        return image;
                    });

                    // Check if the image maximum has been reached
                    if(j >= count) break;
                }
            }

            return images;
        });
}

/**
 * Gets up to the given count (default 10) of images from Wikipedia pages
 * derived from a list of keywords
 * @param {string[]} keywords 
 * @param {number} count 
 * @returns Promise to deliver all images
 */
async function getKeywordImages(keywords, count = 10)
{
    let images = [];
    let j = 0;
    let previous = "aaa";
    for(let i = 0; i < keywords.length; i++)
    {
        if(previous.substr(0, 3).localeCompare(keywords[i].substr(0, 3)) == 0) continue;
        previous = keywords[i];
        let image = await getImagesFromPage(titleToLink(keywords[i]), 1)
            .then(images => {
                if(images && images.length > 0) return images[0];
                return null;        
            });
        if(image) images[j++] = image;
        if(j >= count) break;
    }

    return images;
}

/**
 * Gets all images from a primary Wikipedia article and a list of related
 * articles
 * @param {string} primaryURL URL of primary article
 * @returns Object containing two arrays of images
 */
async function getImages(primaryURL)
{
    return axios.get("https://www.don-hurst.com/keyword")
        .then(async related => 
            {
                related = JSON.parse(related.data).keywords;
                let images = {};
    
                images.primary = await Promise.all(await getImagesFromPage(primaryURL));
                images.related = await Promise.all(await getKeywordImages(related));

                await Promise.all(images.primary.map(async (image) => {
                    image.base64 = await image.base64;
                }));
                await Promise.all(images.related.map(async (image) => {
                    image.base64 = await image.base64;
                }));

                return images;
            });
}

/**
 * Retrieves the binary data for an image at a given URL and converts it into base64
 * https://stackoverflow.com/questions/41846669/download-an-image-using-axios-and-convert-it-to-base64
 * @param {string} url URL of the image
 * @returns base64 encoded image string
 */
function getBase64(url)
{
    return axios
        .get(url, {responseType: 'arraybuffer'})
        .then(response => {
            let type = url.substr(url.lastIndexOf(".") + 1);
            if(type.localeCompare("svg") == 0)
            {
                return response.data;
            }
            else
            {
                return "data:image/" + type + ";base64, " + Buffer.from(response.data, 'binary').toString('base64')
            }
        });
}

/**
* Recieves a request to scrape images based off of a primary Wikipedia article,
* sends a request to Don's transformer for a list of related articles, scrapes
* all the articles for images, and sends a stringified JSON back as a response.
*/
router.get('/apirequest', async function(req, res) {
    let primary = req.query['primary'];
    //let related = !!Make request to tag transformer!!

    //Invalid query
    if(!primary)
    {
        res.render('404', {title:"404"});
        return;
    }

    //Article title given instead of URL
    if(primary.lastIndexOf('/') == -1)
    {
        primary = titleToLink(primary);
    }

    res.send(JSON.stringify(await getImages(primary)));
});

/**
* Recieves a request to scrape images based off of a primary Wikipedia article,
* sends a request to Don's transformer for a list of related articles, scrapes
* all the articles for images, and renders a gallery of all images.
*/
router.get('/results', async function(req, res) {
    //Set up the options object to be passed for rendering
    let options = {
        title: req.query['search'],
        description: "Scraped images",
        images: {'primary':[],'related':[]}
    };
    
    //If the search term was a link, convert it to an article title and store
    if(options.title.lastIndexOf('/') == -1)
    {
        options.link = titleToLink(options.title);
    }
    //If search term was a title, store it and replace the link variable with
    //properly converted text
    else{
        options.link = options.title;
        options.title = linkToTitle(options.title);
    }

    options.images = await getImages(options.link);

    //And do that render magic
    res.render('results', options);
});

module.exports = router;
