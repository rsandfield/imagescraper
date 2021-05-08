var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
    res.redirect('/index');
});

router.get('/index', function(req, res) {
    let options = {
        title: "Index",
        description: "Scrapes images"
    };
    //res.send("Hi there");
    res.render('index', options);
});

module.exports = router;