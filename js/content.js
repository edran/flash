
var highlightedText = "";
var cardExists = false;

/**
 * Add a card to the DOM at the icon location to create a card
 */
async function addCard(termText, x, y, xSize, ySize, element){
  if (!cardExists){
    cardExists = true;
    element.id = "jellyActiveIcon";
    window.getSelection().removeAllRanges();
    var container = document.createElement("div");
    container.classList.add("jellyNewTextCardContainer");
    container.style.position = "absolute";
    xOffset = xSize + 5;
    yOffset = ySize/2 - 100;
    x += xOffset;
    y += yOffset;
    container.style.left = x.toString() + "px";
    container.style.top = y.toString() + "px";
    document.getElementsByTagName("body")[0].appendChild(container);
    $(".jellyNewTextCardContainer").load(
      chrome.extension.getURL('html/text-card-template.html')
    );
    chrome.storage.sync.get("flashCardProgram", async function(response){
      // Fill in different fields based on the chosen flash card program
      switch(response["flashCardProgram"]){
        case "anki":
          await sleep(2);
          var newCard = document.getElementById("jellyNewTextCard");
          newCard.style.backgroundImage = "url(" + chrome.extension.getURL('img/anki_logo.jpg') + ")";
          newCard.style.backgroundRepeat = "no-repeat";
          newCard.style.backgroundSize = "100%";
          await sleep(2);
          $("#jellyNewTextCardDependent").load(chrome.extension.getURL('html/anki/text-fb-card.html'));
          await sleep(2);
          document.getElementById("jellyNewTextTermField").value = highlightedText;
          document.getElementById("jellyNewTextAnswerField").focus();
          break;
        case "quizlet":
          break;
        default:
          console.log("redirect to setup page");
      }
    });
  }
}

/**
 * Create image popup when user highlights text
 */
document.onmouseup = async function(){
  var x = event.pageX;
  var y = event.pageY;

  var clickedElement = event.target;
  var clickedIcon = elementClassContainsClick(["jellyIcon"], clickedElement);
  var clickedCard = elementClassContainsClick(["jellyNewTextCard"], clickedElement);
  if(clickedIcon != null){
    var cardLeftStart = parseInt(clickedIcon.style.left);
    var cardTopStart = parseInt(clickedIcon.style.top);
    addCard(
      highlightedText,
      cardLeftStart,
      cardTopStart,
      clickedIcon.offsetWidth,
      clickedIcon.offsetHeight,
      clickedIcon
    );
  }else if(clickedCard != null){

  }else{
    clearClass("jellyIcon");
    clearClass("jellyNewTextCardContainer");
    cardExists = false;
    if(window.getSelection().toString() != ""){
      var xOffset = -9;
      var yOffset = 10;
      var xSize = 18;
      var ySize = 18
      x += xOffset;
      y += yOffset;
      await sleep(1);
      highlightedText = window.getSelection().toString();
      if(highlightedText != ""){
        var icon = document.createElement("div");
        icon.classList.add("jellyIcon");
        icon.style.position = "absolute";
        icon.style.width = xSize.toString() + "px";
        icon.style.height = ySize.toString() + "px";
        icon.style.left = x.toString() + "px";
        icon.style.top = y.toString() + "px";
        icon.innerHTML = "<img src='" + chrome.extension.getURL('img/icon.png') + "' />";
        document.getElementsByTagName("body")[0].appendChild(icon);
      }
    }
  }


}

/**
 * Return true if an element with a class in classList contains clicked_element
 */
function elementClassContainsClick(classList, clicked_element){
  while(true){
    if(hasOverlap(Array.from(clicked_element.classList), classList)){
      break;
    }else if(clicked_element.parentNode == document){
      clicked_element = null;
      break;
    }else{
      clicked_element = clicked_element.parentNode;
    }
  }
  return clicked_element;
}

/**
 * Return true if the lists intersect (their union is not the emptyset)
 */
function hasOverlap(list1, list2){
  for (var i = 0; i<list1.length; i++){
    if(list2.includes(list1[i])){
      return(true);
    }
  }
  return(false);
}

/**
 * Delete existing image popups if the user doesn't highlight anything
 */
function clearClass(className){
  try{
    var icons = document.getElementsByClassName(className);
    for(var i = 0; i < icons.length; i++){
      icons[i].parentNode.removeChild(icons[i]);
    }
  }catch(exception){}
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}
