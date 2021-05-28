function openModal(id)
{
    document.getElementById(id).style.display = "block";
    console.log("Opening " + id);
    window.addEventListener('mousedown', function outsideClick(e){
        if (!document.getElementById(id).contains(e.target))
        {
            hideModal(id);
            this.removeEventListener('mousedown', outsideClick)
        }
    });
}

function hideModal(id)
{
    document.getElementById(id).style.display = "none";
    console.log("Closing " + id);
}