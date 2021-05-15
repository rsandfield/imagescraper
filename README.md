# imagescraper
This microservice will scrape a targeted Wikipedia article and a number of
related articles for images and display in a gallery or return them as an object
depending on use through the GUI or API. The API expects the request to place
either the Wikipedia article title or URL in a variable named 'search' and will
return results in two arrays of base64-formatted images named 'primary' and
'related'.
