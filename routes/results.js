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
            let image = await axios.get("https:" + $$('#file')[0].children[0].attribs.href);
            images.push(image);
        }
    }

    return images;
}

router.get('/results', async function(req, res) {
    let options = {
        title: req.query['search'],
        description: "Scraped images",
        images: {'primary':[],'related':[]}
    };
    
    if(options.title.lastIndexOf('/') == -1)
    {
        options.link = titleToLink(options.title);
    }
    else{
        options.link = options.title;
        options.title = linkToTitle(options.title);
    }

    options.images.primary = await getImages(options.link);

    console.log(options.images.primary.length, options.images.related.length);
    res.render('results', options);
});

module.exports = router;