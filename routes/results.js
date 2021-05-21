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
    let $ = await fetchHTML(link);
    let body = ($('#content')[0]);
    let linkNodes = $('a');

    images = [];

    let j = 0;
    //Iterate through all links
    for(let i = 0; i < linkNodes.length; i++)
    {
        //Extract node object from cheeriojs function
        let node = linkNodes[i];
        
        //Check that link node is a content image
        if
        ( 
            $.contains(body, node)                                                  //Link is within body
            && node.attribs.class && node.attribs.class.localeCompare('image') == 0 //Link contains image node
            //Parent node is of type only used for content
            && node.parent.attribs.class
            && (
                node.parent.attribs.class.localeCompare('thumbinner') == 0 ||
                node.parent.attribs.class.localeCompare('infobox-image') == 0
            )
            //Not an SVG
            && node.attribs.href.substr(node.attribs.href.lastIndexOf(".") + 1).localeCompare("svg") != 0
        )
        { 
            let imagePage = ('https://en.wikipedia.org' + node.attribs.href);
            images[j++] = fetchHTML(imagePage).then($$ => {
                return getBase64("https:" + $$('#file')[0].children[0].attribs.href)});
            if(j >= count) break;
        }
    }

    return images;
}

async function getKeywordImages(keywords, count = 10)
{
    let images = [];
    let j = 0;
    let previous = null;
    for(let i = 0; i < keywords.length; i++)
    {
        //Prevent dupicates
        //Check returned article title
        let title = titleToLink(keywords[i]);
        let page = await fetchHTML(title).then($ => {
            try
            {
                return ($('title')[0]).children[0].data;
            }
            catch(e)
            {
                return null;
            }
        });

        //Check returned article title against previous successful read
        if(!page || page.localeCompare(previous) == 0) continue;
        previous = page;

        let image = await getImagesFromPage(titleToLink(keywords[i]), 1);
        if(image && image.length > 0) 
        {
            images[j++] = image[0];
        }
        if(j >= count) break;
    }

    return images;
}

async function getImages(primary)
{
    return axios.get("https://www.don-hurst.com/keyword")
        .then(async related => 
            {
                related = JSON.parse(related.data).keyword_list;
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