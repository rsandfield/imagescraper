var express = require('express');
var cheerio = require('cheerio');
var axios = require("axios");
var router = express.Router();
var FileReader = require("filereader");
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
    return title.replace('_', ' ');
}

async function fetchHTML(url) {
    let {data} = await axios.get(url);
    return cheerio.load(data);
}

async function getImages(link, count = Infinity)
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
        if( $.contains(body, node) &&                                            //Link is within body
            node.attribs.class && node.attribs.class.localeCompare('image') == 0 && //Link contains image node
            node.parent.attribs.class && (                                          //Parent node is of type only used for content
                node.parent.attribs.class.localeCompare('thumbinner') == 0 ||
                node.parent.attribs.class.localeCompare('infobox-image') == 0
            )
        )
        {
            let imagePage = ('https://en.wikipedia.org' + node.attribs.href);
            let $$ = await fetchHTML(imagePage);
            images[j++] = await getBase64("https:" + $$('#file')[0].children[0].attribs.href);
        }
    }

    return images;
}

/*
Function: getBase64
-------------------
https://stackoverflow.com/questions/41846669/download-an-image-using-axios-and-convert-it-to-base64

*/
function getBase64(url) {
    return axios
      .get(url, {
        responseType: 'arraybuffer'
      })
      .then(response => Buffer.from(response.data, 'binary').toString('base64'))
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

    let response = {'primary':[],'related':[]};

    if(primary.lastIndexOf('/') == -1)
    {
        primary = titleToLink(options.title);
    }

    response.primary = await getImages(options.link);

    res.send(JSON.stringify(response));
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

    //Populate the primary images gallery
    options.images.primary = await getImages(options.link);

    //And do that render magic
    res.render('results', options);
});

module.exports = router;