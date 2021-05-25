var express = require('express');
var cheerio = require('cheerio');
var axios = require("axios");
var router = express.Router();
var FileReader = require("filereader");
const { prev } = require('cheerio/lib/api/traversing');
var reader = new FileReader();

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

async function getImagesFromPage(link, count = Infinity)
{
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
                    let imagePage = ('https://en.wikipedia.org' + node.attribs.href);
                    images[j++] = fetchHTML(imagePage)
                        .then($$ => {
                            let preview = $$('.mw-filepage-resolutioninfo').children('a');
                            if(preview.length > 0)
                            {
                                return getBase64("https:" + preview[0].attribs.href);
                            }
                            else
                            {
                                return getBase64("https:" + $$('#file')[0].children[0].attribs.href)
                            }
                        });
                    if(j >= count) break;
                }
            }

            return images;
        });
}

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

async function getImages(primary)
{
    return axios.get("https://www.don-hurst.com/keyword")
        .then(async related => 
            {
                related = JSON.parse(related.data).keywords;
                let images = {};
    
                images.primary = await Promise.all(await getImagesFromPage(primary));
                images.related = await Promise.all(await getKeywordImages(related));

                return images;
            });
}

/*
Function: getBase64
-------------------
https://stackoverflow.com/questions/41846669/download-an-image-using-axios-and-convert-it-to-base64

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

/*
Route: apirequest
-----------------
Recieves a request to scrape images based off of a primary Wikipedia article,
sends a request to Don's transformer for a list of related articles, scrapes
all the articles for images, and sends a stringified JSON back as a response.
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

/*
Route: results
--------------
Recieves a request to scrape images based off of a primary Wikipedia article,
sends a request to Don's transformer for a list of related articles, scrapes
all the articles for images, and renders a gallery of all images.
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
