
var highlightedText = "";
var highlightPos = [0, 0];
var cardExists = false;
var ankiAddress = "";
var ankiVersion = "";
var ctrlDown = false;
var altDown = false;
var newCardIdBufferLen = 17;
var cardFollowMouse = false;
var offset = [0, 0];
var maxInt = 2147483647; // Max size of an integer. Should always be on top.

var keyCallbacks = {
  "activationKey": {"callbackDown": "", "callbackUp": "activateIcon"},
  "pictureTerms": {"callbackDown": "", "callbackUp": ""},
  "audioTerms": {"callbackDown": "", "callbackUp": ""},
  "visibilityToggle": {"callbackDown": "makeCardInvisible", "callbackUp": "makeCardVisible"}
};

/**
 * Trigger keydown functions
 */
document.onkeydown = function(e){
  switch(e.key){
    case "Alt":
      altDown = true;
      break;
    case "Control":
      ctrlDown = true;
      break;
    default:
      chrome.storage.sync.get(null, function(response){
        for(var val in response){
          var key = response[val].key;
          if(key !== undefined && key === e.key && ctrlDown && altDown){
            if(keyCallbacks[val]["callbackDown"] !== ""){
              window[keyCallbacks[val]["callbackDown"]]();
            }
          }
        }
      });
  }
}

document.onkeyup = function(e){
  switch(e.key){
    case "Alt":
      altDown = false;
      break;
    case "Control":
      ctrlDown = false;
      break;
    default:
      chrome.storage.sync.get(null, function(response){
        for(var val in response){
          var key = response[val].key;
          if(key !== undefined && key === e.key && ctrlDown && altDown){
            if(keyCallbacks[val]["callbackUp"] !== ""){
              window[keyCallbacks[val]["callbackUp"]]();
            }
          }
        }
      });
  }
}

/**
 * Make the flash card invisible (if it exists) to allow the user to see text
 * they can highlight for the answer.
 */
function makeCardInvisible(){
  var cardContainer = document.getElementById("jellyNewCardContainer");
  if(cardContainer !== null){
    cardContainer.style.display = "none";
  }
}

/**
 * Make the flash card visible (if it exists)
 */
function makeCardVisible(){
  var cardContainer = document.getElementById("jellyNewCardContainer");
  if(cardContainer !== null){
    cardContainer.style.display = "block";
  }
}

/**
 * Add a card to the DOM at the icon location to create a card
 */
function addCard(termText, x, y, xSize, ySize, element){
  if (!cardExists){
    cardExists = true;
    element.id = "jellyActiveIcon";
    window.getSelection().removeAllRanges();
    var container = document.createElement("div");
    container.classList.add("jellyNewCardContainer");
    container.id = "jellyNewCardContainer";
    container.style.position = "absolute";
    container.style.backgroundColor = "#ffffff";
    xOffset = xSize + 5;
    yOffset = ySize/2 - 100;
    x += xOffset;
    y += yOffset;
    container.style.left = x.toString() + "px";
    container.style.top = y.toString() + "px";
    container.style.zIndex = maxInt;
    document.getElementsByTagName("body")[0].appendChild(container);
    var xhr = new XMLHttpRequest();
    xhr.open('GET', chrome.runtime.getURL('html/card-template.html'));
    xhr.onreadystatechange = function(){
      if(this.readyState !== 4)return;
      if(this.status !== 200)return;
      var cardContainers = document.getElementsByClassName("jellyNewCardContainer");
      if(cardContainers.length > 0 && cardContainers[0] !== null){
        cardContainers[0].innerHTML = this.responseText;
        fillInCard();
      }
    }
    xhr.send();
  }
}

/**
 *  A function to fill in the detials of a card based on the program the user has
 *  selected.
 */
function fillInCard(){
  chrome.storage.sync.get("flashCardProgram", function(response){
    var newCard = document.getElementById("jellyNewCard");
    if(newCard === null)return;
    newCard.style.backgroundRepeat = "no-repeat";
    newCard.style.backgroundSize = "cover";
    try{
      document.getElementById("jellyLoadingIcon").src = chrome.extension.getURL("img/loading.gif");
    }catch(e){console.log("No loading icon.");}
    // Fill in different fields based on the chosen flash card program
    switch(response["flashCardProgram"]){
      case "anki":
        newCard.style.backgroundImage = "url(" + chrome.runtime.getURL('img/anki_logo.jpg') + ")";
        document.getElementById("jellySaveButton").onclick = saveAnkiCard;
        chrome.storage.sync.get(["ankiVersion", "ankiAddress"], function(response){
          if(response.ankiVersion === undefined || response.ankiAddress === undefined){
            alert("You haven't set up Anki");
            chrome.runtime.sendMessage({"purpose": "createTab", "url": "/html/options.html"});
          }else{
            ankiAddress = response.ankiAddress;
            ankiVersion = response.ankiVersion;
            ankiRequest(displayAnkiConfig, "multi", {
              "actions": [
                {"action": "deckNames"},
                {"action": "modelNames"}
              ]
            });
          }
        });
        break;
      case "quizlet":
        newCard.style.backgroundImage = "url(" + chrome.runtime.getURL('img/quizlet_logo.png') + ")";
        document.getElementById("jellySaveButton").onclick = saveQuizletCard;
        chrome.storage.sync.get("quizletUsername", function(response){
          if(response.quizletUsername === undefined){
            alert("You haven't set up Quizlet");
            chrome.runtime.sendMessage({"purpose": "createTab", "url": "/html/options.html"});
          }else{
            quizletRequest(
              displayQuizletConfig,
              "GET",
              "/users/" + response.quizletUsername + "/sets",
            );
          }
        });
        break;
      default:
        alert("You don't have any flash card program set up.");
        chrome.runtime.sendMessage({
          "purpose": "createTab",
          "url": chrome.runtime.getURL("../html/options.html")
        });
    }
  });
}

/**
 * Display Anki Config info based on the user's anki account info
 */
function displayAnkiConfig(accountInfo){
  var deckNames = accountInfo[0];
  var modelNames = accountInfo[1];
  if(deckNames.length <= 0){
    alert("You don't have any Anki decks! Make a deck before using Jelly!");
    newAnkiDeck();
    closeCard();
    return;
  }
  if(modelNames.length <= 0){
    alert("You don't have any Anki models! Make a model before using Jelly!");
    closeCard();
    return;
  }
  chrome.storage.sync.get(["ankiDeck", "ankiModel"], function(response){
    var deck;
    var model;
    if(response.ankiDeck === undefined || !deckNames.includes(response.ankiDeck)){
      deck = deckNames[0];
    }else{
      deck = response.ankiDeck;
    }
    if(response.ankiModel === undefined || !modelNames.includes(response.ankiModel)){
      model = modelNames[0];
    }else{
      model = response.ankiModel;
    }
    chrome.storage.sync.set({"ankiDeck": deck, "ankiModel": model}, function(){});
    document.getElementById("jellyNewCardConfig").innerHTML = (`
      <div id="jellyNewAnkiCardDeckBox">
        <label for="jellyNewAnkiCardDeck" class="jellyNewAnkiCardConfigLabel">
          Deck:
        </label>
        <select id="jellyNewAnkiCardDeck" class="jellyNewAnkiCardConfig jellyNewAnkiCardConfigSelect">
        </select>
      </div>
      <div id="jellyNewAnkiDeckBox">
        <button id="jellyNewAnkiDeck" class="jellyNewAnkiCardConfig">
          New Deck
        </button>
      </div>
      <div id="jellyNewAnkiCardModelBox">
        <label for="jellyNewAnkiCardModel" class="jellyNewAnkiCardConfigLabel">
          Model:
        </label>
        <select id="jellyNewAnkiCardModel" class="jellyNewAnkiCardConfig jellyNewAnkiCardConfigSelect">
        </select>
        <style>
          #jellyNewCard #jellyNewCardConfig .jellyNewAnkiCardConfig{
            -webkit-border-radius: 5px;
            -moz-border-radius: 5px;
            border-radius: 5px;
            background-image: -webkit-gradient(linear, left bottom, left top, color-stop(0.16, rgb(207, 207, 207)), color-stop(0.79, rgb(252, 252, 252)));
            background-image: -moz-linear-gradient(center bottom, rgb(207, 207, 207) 16%, rgb(252, 252, 252) 79%);
            background-image: linear-gradient(to top, rgb(207, 207, 207) 16%, rgb(252, 252, 252) 79%);
            padding: 3px;
            margin:5px;
          }
        </style>
      </div>`);
    var configLabels = document.getElementsByClassName("jellyNewAnkiCardConfigLabel");
    for (var i =0; i<configLabels.length; i++){
      configLabels[i].style.backgroundColor = "#ffffff";
      configLabels[i].style.margin = "5px";
    }

    var newDeckButton = document.getElementById("jellyNewAnkiDeck");
    newDeckButton.onclick = function(){
      newAnkiDeck(deckNames);
    }

    var deckSelect = document.getElementById("jellyNewAnkiCardDeck");
    var modelSelect = document.getElementById("jellyNewAnkiCardModel");
    deckSelect.innerHTML = generateOptionsList(deckNames);
    modelSelect.innerHTML = generateOptionsList(modelNames);
    changeSelection("jellyNewAnkiCardDeck", deck);
    changeSelection("jellyNewAnkiCardModel", model);
    deckSelect.onchange = saveAnkiCardConfig
    modelSelect.onchange = ankiModelUpdate;
    ankiModelUpdate();
  });
}

/**
 *  Put the fields of the card into the web page so they can be edited.
 */
function displayFields(fields){
  var fieldString = "";
  for(var i = 0; i<fields.length; i++){
    fieldString += "<div id=\"jellyNewCardField" + fields[i] + "Box\" class=\"jellyNewCardFieldBox\">";
    fieldString += "<label for=\"jellyNewCardField" + fields[i] + "\" class=\"jellyNewCardLabel\">" + fields[i] + ":</label><br/>"
    fieldString += "<div id=\"jellyNewCardInputBox" + fields[i] + "\" class=\"jellyNewCardInputBox\">"
    fieldString += "<textarea rows=\"2\" cols=\"20\" id=\"jellyNewCardField" + fields[i] + "\" class=\"jellyNewCardField\"></textarea>"
    fieldString += "</div>"
    fieldString += "</div>"
  }
  fieldString += `<style>
    .cleanslate #jellyNewCardDependent .jellyNewCardFieldBox{
      margin:5px ;
    }
    .cleanslate #jellyNewCardDependent .jellyNewCardInputBox{
      margin: 5px ;
      display: flex ;
      flex-direction: row ;
      flex-wrap: wrap ;
    }
    .cleanslate #jellyNewCardDependent .jellyNewCardField{
      width: 90% ;
      margin: auto ;
      display: block ;
      resize: none ;
    }
    .cleanslate #jellyNewCardDependent .jellyNewCardLabel{
      background-color: #ffffff ;
    }
    .cleanslate #jellyNewCardDependent .jellyNewCardInputBox textarea{
      font-size:14px;
      line-height:18px;
      height: 2.75em;
    }
  </style>`;
  var dependentDiv = document.getElementById("jellyNewCardDependent");
  if(dependentDiv === null){
    console.log("Couldn't find element of id `jellyNewCardDependent`");
    return;
  }
  dependentDiv.style.display = "block";
  dependentDiv.innerHTML = fieldString;
  var cardFields = document.getElementsByClassName("jellyNewCardField");
  if(cardFields.length > 0){
    chrome.storage.sync.get(["highlightPref", "focusPref"], function(response){
      var highlightIndex = response.highlightPref;
      if(highlightIndex === undefined)highlightIndex = 0;
      try{
        cardFields[highlightIndex].innerText = highlightedText;
      }catch(e){
        cardFields[0].innerText = highlightedText;
        notify("warning", "Highlight index " + (highlightIndex + 1).toString() + " out of range", 2000);
      }
      var focusIndex = response.focusPref;
      if(focusIndex === undefined)focusIndex = 1;
      if(focusIndex >= cardFields.length){
        notify("warning", "Focus index " + (focusIndex + 1).toString() + " was out of range", 2000);
        focusIndex = cardFields.length - 1;
      }
      cardFields[focusIndex].focus();
      autoTranslate(highlightedText, cardFields[focusIndex]);
    });
  }else{
    notify("error", "No new card fields?", 3000);
    closeCard();
  }
}

function autoTranslate(text, textElement){
  chrome.storage.sync.get(["autoTranslate","sourceLang", "targetLang"], function(response){
    if(response.autoTranslate){
      var sourceLang;
      var targetLang;
      if(response.sourceLang === undefined)sourceLang = "de";
      else sourceLang = response.sourceLang;
      if(response.targetLang === undefined)targetLang = "en";
      else targetLang = response.targetLang;
      var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=" + sourceLang + "&tl=" + targetLang + "&dt=t&q=" + encodeURI(text);
      fetch(url)
        .then(
          function(translationResponse){
            if(translationResponse.status !== 200){
              console.log("translation error " + translationResponse.status);
              return;
            }
            translationResponse.json().then(function(data){
              try{
                textElement.innerText = data[0][0][0];
              }catch(e){
                console.log(e);
                notify("error", "Couldn't translate.", 2000);
              }
            });
          }
        )
        .catch(function(err){
          console.log("Fetch error ", err);
        })
    }
  });
}

/**
 * Save the anki card to the database
 */
function saveAnkiCard(){
  var fields = document.getElementsByClassName("jellyNewCardField");
  if(fields.length <= 0){
    console.log("No Jelly fields found.");
    return;
  }
  var output = {};
  for(var i = 0; i<fields.length; i++){
    if(fields[i].value === ""){
      alert("You must fill out all fields!");
      return;
    }else{
      var fieldName = fields[i].getAttribute("id");
      output[fieldName.slice(newCardIdBufferLen)] = fields[i].value;
    }
  }
  var deck = document.getElementById("jellyNewAnkiCardDeck");
  var model = document.getElementById("jellyNewAnkiCardModel");
  if(deck === null){
    console.log("No deck info found at id `jellyNewAnkiCardDeck`.");
    return;
  }
  if(model === null){
    console.log("No model info found at id `jellyNewAnkiCardModel`.");
    return;
  }
  ankiRequest(ankiCardWrapUp, "addNote", {
    "note": {
      "deckName": deck.value,
      "modelName": model.value,
      "fields": output,
      "tags":[
        "jelly"
      ]
    }
  });
}

function ankiCardWrapUp(responseText){
  if(responseText !== null){
    notify("success", "Anki card saved!", 2000);
  }else{
    notify("error", "Save failed :(", 2000);
  }
  closeCard();
}

function newAnkiDeck(existingDecks){
  var newDeckName = prompt("Please enter the name of the new deck").trim();
  if(newDeckName !== null){
    if(!existingDecks.includes(newDeckName)){
      chrome.storage.sync.set({"ankiDeck": newDeckName}, function(response){
        ankiRequest(addNewDeckToActiveAnkiCard, "createDeck", {"deck": newDeckName});
      });
    }else{
      notify("warning", "Deck already exists", 3000);
    }
  }
}

function addNewDeckToActiveAnkiCard(response){
  notify("success", "Added new deck", 2000);
  fillInCard();
}

function displayQuizletConfig(setInfo){
  var sets = [];
  var setNames = [];
  var setIds = [];
  for(var i = 0; i < setInfo.length; i++){
    var title = setInfo[i].title;
    var id = setInfo[i].id;
    sets.push({id: title});
    setNames.push(title);
    setIds.push(id);
  }
  if(sets.length <= 0){
    alert("You don't have any Quizlet sets! Make a set before using Jelly!");
    newQuizletSet();
    closeCard();
    return;
  }
  chrome.storage.sync.get("quizletSetId", function(response){
    var currSetId;
    if(response.quizletSetId === undefined || !setIds.includes(response.quizletSetId)){
      currSetId = setIds[0];
    }else{
      currSetId = response.quizletSetId;
    }
    chrome.storage.sync.set({"quizletSetId": currSetId});
    document.getElementById("jellyNewCardConfig").innerHTML = (`
      <div id="jellyNewQuizletCardDeckBox">
      <label for="jellyNewQuizletCardDeck" class="jellyNewQuizletCardConfigLabel">Set:
      </label>
      <select id="jellyNewQuizletCardSet" class="jellyNewQuizletCardConfig jellyNewQuizletCardConfigSelect" style="-webkit-border-radius: 5px;
        -moz-border-radius: 5px;
        border-radius: 5px;
        background-image: -webkit-gradient(linear, left bottom, left top, color-stop(0.16, rgb(207, 207, 207)), color-stop(0.79, rgb(252, 252, 252)));
        background-image: -moz-linear-gradient(center bottom, rgb(207, 207, 207) 16%, rgb(252, 252, 252) 79%);
        background-image: linear-gradient(to top, rgb(207, 207, 207) 16%, rgb(252, 252, 252) 79%);
        padding: 3px;">
      </select>
      </div>
      <div id="jellyNewQuizletSetBox" style="margin:5px;">
        <button id="jellyNewQuizletSet" class="jellyNewQuizletCardConfig">New Set</button>
      </div>
    `);

    try{
      document.getElementById("jellyNewQuizletSet").onclick = newQuizletSet;
    }catch(e){
      console.log(e);
    }

    var configLabel = document.getElementsByClassName("jellyNewQuizletCardConfigLabel")[0];
    if(configLabel === null){
      console.log("Couldn't find element with id `jellyNewQuizletCardConfigLabel` in function `displayQuizletConfig`");
      return;
    }
    configLabel.style.backgroundColor = "#ffffff";
    configLabel.style.margin = "5px";
    var setSelect = document.getElementById("jellyNewQuizletCardSet");
    if(setSelect === null){
      console.log("Couldn't find element with id `jellyNewQuizletCardSet` in function `displayQuizletConfig`");
      return;
    }
    setSelect.innerHTML = generateOptionsList(setNames, setIds);
    changeSelection("jellyNewQuizletCardSet", currSetId);
    setSelect.onchange = function(){
      chrome.storage.sync.set({"quizletSetId": document.getElementById("jellyNewQuizletCardSet").value}, function(){});
    };
    displayFields(["Term", "Definition"]);
  });
}

function saveQuizletCard(){
  var set = document.getElementById("jellyNewQuizletCardSet");
  if(set === null){
    console.log("Couldn't find element with id `jellyNewQuizletCardSet` in function `saveQuizletCard`");
    return;
  }
  var setId = set.value.toString()
  var output = {};
  var cardFields = document.getElementsByClassName("jellyNewCardField");
  if(cardFields.length <= 0){
    console.log("Couldn't find any cardFields in function `saveQuizletCard`");
    return;
  }
  for(var i = 0; i<cardFields.length; i++){
    output[cardFields[i].getAttribute("id").slice(newCardIdBufferLen).toLowerCase()] = cardFields[i].value;
  }
  quizletRequest(quizletCardWrapUp, "POST", "/sets/" + setId + "/terms", output);
  setTimeout(function(){
    tryToDeleteQuizletSentinels(setId);
  }, 3000);
}

function quizletCardWrapUp(response){
  if(response.id !== undefined){
    notify("success", "Quizlet card saved!", 2000);
  }else{
    notify("error", "Save failed :(", 2000);
  }
  closeCard();
}

function newQuizletSet(){
  var newSetName = prompt("Please enter the name of the new set").trim();
  if(newSetName !== null){
    quizletRequest(
      addNewSetToActiveQuizletCard,
      "POST",
      "/sets",
      {
        "title": newSetName,
        "terms": ["jellySentinel!@#$%^&*()", "jellySentinel)(*&^%$#@!"],
        "definitions": ["jellySentinel!@#$%^&*()", "jellySentinel)(*&^%$#@!"],
        "lang_terms": "en",
        "lang_definitions": "en"
      }
    );
  }
}

function addNewSetToActiveQuizletCard(response){
  chrome.storage.sync.set({"quizletSetId": response.set_id}, function(response){
    notify("success", "Added new set", 2000);
    fillInCard();
  });
}

function tryToDeleteQuizletSentinels(setId){
  quizletRequest(deleteQuizletSentinels, "GET", "/sets/" + setId);
}

function deleteQuizletSentinels(response){
  var setId = response.id.toString();
  var terms = response.terms;
  for(var i = 0; i<terms.length; i++){
    if(terms[i].term === "jellySentinel!@#$%^&*()" || terms[i].term === "jellySentinel)(*&^%$#@!"){
      deleteQuizletTerm(setId, terms[i].id);
      break;
    }
  }
}

function deleteQuizletTerm(setId, termId){
  quizletRequest(notifyDeletion, "DELETE", "/sets/" + setId + "/terms/" + termId);
}

function notifyDeletion(response){
  notify("success", "Sentinel deleted", 1000);
}

/**
 * Clear out any existing cards or icons
 */
function closeCard(){
  clearClass("jellyIcon");
  clearClass("jellyNewCardContainer");
  cardExists = false;
}

/**
 * Create image popup when user highlights text
 */
document.onmouseup = async function(){
  cardFollowMouse = false;
  var x = event.pageX;
  var y = event.pageY;
  highlightPos = [x, y];

  var clickedElement = event.target;
  var clickedIcon = elementClassContainsClick(["jellyIcon"], clickedElement);
  var clickedCard = elementClassContainsClick(["jellyNewCardContainer"], clickedElement);
  if(clickedIcon != null){
    var cardLeftStart = parseInt(clickedIcon.style.left);
    var cardTopStart = parseInt(clickedIcon.style.top);
    var iconWidth = clickedIcon.offsetWidth;
    //Put card on other side of icon if too close to right border (card is maximally 300px wide).
    if(document.documentElement.clientWidth - event.clientX < 300 + iconWidth){
      iconWidth = -300 - iconWidth;
    }
    addCard(
      highlightedText,
      cardLeftStart,
      cardTopStart,
      iconWidth,
      clickedIcon.offsetHeight,
      clickedIcon
    );
  }else if(clickedCard != null){

  }else{
    highlightedText = window.getSelection().toString().trim();
    if(highlightedText != ""){
      await sleep(1);
      highlightedText = window.getSelection().toString().trim();
      if(highlightedText != ""){
        if(!cardExists){
          chrome.storage.sync.get("activationKey", function(response){
            if(response.activationKey.key === "off"){
              makeIcon(x, y);
            }
          });
        }else{
          chrome.storage.sync.get("highlightAnswer", function(highlightStatus){
            if(highlightStatus.highlightAnswer){
              chrome.storage.sync.get("focusPref", function(response){
                var cardFields = document.getElementsByClassName("jellyNewCardField");
                if(cardFields.length <= 0){
                  return;
                }
                var focusIndex = response.focusPref;
                if(focusIndex === undefined)focusIndex = 1;
                if(focusIndex >= cardFields.length){
                  notify("warning", "Focus index " + (focusIndex + 1).toString() + " was out of range", 2000);
                  focusIndex = cardFields.length - 1;
                }
                cardFields[focusIndex].innerText = highlightedText;
              });
            }else{
              closeCard();
              chrome.storage.sync.get("activationKey", function(response){
                if(response.activationKey.key === "off"){
                  makeIcon(x, y);
                }
              });
            }
          });
        }
      }else{
        closeCard();
      }
    }else{
      closeCard();
    }
  }


}

document.onmousedown = function(){
  var target = event.target;
  var pos = [event.pageX, event.pageY];
  var clickedCard = elementClassContainsClick(["jellyNewCardContainer"], target);
  if(clickedCard !== null){
    cardFollowMouse = true;
    offset = [pos[0] - parseInt(clickedCard.style.left), pos[1] - parseInt(clickedCard.style.top)];
  }else{
    cardFollowMouse = false;
  }
}

document.onmousemove = function(){
  var pos = [event.pageX, event.pageY];
  var card = document.getElementsByClassName("jellyNewCardContainer");
  if(card.length <= 0)return;
  else card = card[0];
  if(cardFollowMouse){
    card.style.left = (pos[0] - offset[0]).toString() + "px";
    card.style.top = (pos[1] - offset[1]).toString() + "px";
  }
}

/**
 * Create icon at (absolute) position x, y
 */
function makeIcon(x, y){
  clearClass("jellyIcon");
  var xOffset = -9;
  var yOffset = 10;
  var xSize = 18;
  var ySize = 18
  x += xOffset;
  y += yOffset;
  var icon = document.createElement("div");
  icon.classList.add("jellyIcon");
  icon.style.position = "absolute";
  icon.style.width = xSize.toString() + "px";
  icon.style.height = ySize.toString() + "px";
  icon.style.left = x.toString() + "px";
  icon.style.top = y.toString() + "px";
  icon.innerHTML = "<img src='" + chrome.extension.getURL('img/icon.png') + "' />";4
  icon.style.zIndex = maxInt;
  document.getElementsByTagName("body")[0].appendChild(icon);
}

/**
 * Create an icon at the last highlighted position if text is highlighted and
 * the activation key is pressed.
 */
function activateIcon(){
  if(highlightedText !== ""){
    makeIcon(highlightPos[0], highlightPos[1]);
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
    do{
      var icons = document.getElementsByClassName(className);
      icons[0].parentNode.removeChild(icons[0]);
    }while(icons.length > 0);
  }catch(exception){}
}

/**
 *  Make a request to the anki api
 */
function ankiRequest(callbackFunc, action, params={}){
  chrome.runtime.sendMessage({
    "purpose": "ankiRequest",
    "callback": callbackFunc.name,
    "address": ankiAddress,
    "action": action,
    "version": ankiVersion,
    "params": params
  });
}

function quizletRequest(callback, method, endpoint, params={}){
  chrome.storage.sync.get("quizletAccessToken", function(response){
    if(response.quizletAccessToken !== undefined){
      chrome.runtime.sendMessage({
        "purpose": "quizletRequest",
        "callback": callback.name,
        "access_token": response.quizletAccessToken,
        "method": method,
        "endpoint": endpoint,
        "params": params
      });
    }else{
      alert("You haven't set up Quizlet!");
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
  if(request.type === "ankiResponse"){
    if(request.error !== null){
      console.log(request.error);
      alert(request.error.charAt(0).toUpperCase() + request.error.slice(1));
      closeCard();
    }else{
      try{
        window[request.callback](request.result);
      }catch(e){
        console.log(e);
      }
    }
  }else if(request.type === "quizletResponse"){
    try{
      window[request.callback](request.response);
    }catch(e){
      console.log(e);
    }
  }
});

/**
 *  Create a string of options where each value and text element are the elements
 *  of inputArr
 */
function generateOptionsList(inputArr, values=[]){
  var str = "";
  if(values.length === 0 || values.length !== inputArr.length){
    for(var i in inputArr){
      str += "<option value=\"" + inputArr[i] + "\">" + inputArr[i] + "</option>"
    }
  }else{
    for(var i = 0; i<inputArr.length; i++){
      str += "<option value=\"" + values[i] + "\">" + inputArr[i] + "</option>"
    }
  }
  return str;
}

/**
 *  Save the user's last used deck and/or model
 */
function saveAnkiCardConfig(){
  var deck = document.getElementById("jellyNewAnkiCardDeck");
  var model = document.getElementById("jellyNewAnkiCardModel");
  var error = false;
  if(deck === null){
    console.log("No Anki deck info with id `jellyNewAnkiCardDeck` to save");
    error = true;
  }
  if(model === null){
    console.log("No Anki model info with id `jellyNewAnkiCardModel` to save");
    error = true;
  }
  if(error)return;
  chrome.storage.sync.set({"ankiDeck": deck.value, "ankiModel": model.value});
}

/**
 *  Save the model preference and update the displayed fields based on the model
 */
function ankiModelUpdate(){
  saveAnkiCardConfig();
  ankiRequest(displayFields, "modelFieldNames", {"modelName": document.getElementById("jellyNewAnkiCardModel").value})
}

/**
 * Change the selected value of the element identified by id `idName` to
 * the value named by `targVal`
 */
 function changeSelection(idName, targVal){
   var selElem = document.getElementById(idName);
   if(selElem != null){
     var opts = selElem.options;
     for (var i = 0; i<opts.length; i++){
       if (opts[i].value == targVal){
         selElem.selectedIndex = i;
         return true;
       }
     }
     return false;
   }else{
     return false;
   }
 }

/**
 * Create a notification banner in the top right of the screen that automatically
 * disappears after `timeout` milliseconds
 */
function notify(type, message, timeout){
  var notificationContainer = document.createElement("div");
  notificationContainer.classList.add("jellyNotificationContainer");
  notificationContainer.style.top = "10px";
  notificationContainer.style.right = "10px";
  notificationContainer.style.position = "fixed";
  var color;
  switch(type){
    case "success":
      color = "#66ff66";
      break;
    case "warning":
      color = "#ffff66";
      break;
    case "error":
      color = "#ff6666";
      break;
    default:
  }
  notificationContainer.style.backgroundColor = color;
  notificationContainer.style.zIndex = maxInt;
  document.getElementsByTagName("body")[0].appendChild(notificationContainer);
  var notificationString = `<div class="jellyNotification">
      <img src="" id="jellyNotificationIcon"/>
      <p class="jellyNotificationText">`;
  notificationString += message;
  notificationString += `</p>
    </div>

    <style>
      .jellyNotification{
        width:300px;
        height:50px;
        border: 4px solid rgba(32, 32, 32, 0.5);
        display: flex;
        flex-direction: row;
        overflow: hidden;
        flex-wrap:no-wrap;
        align-items: center;
      }
      .jellyNotificationContainer:hover{
        opacity: 0.2;
      }
      .jellyNotificationText{
        margin-top:auto;
        margin-bottom:auto;
        margin-left:3px;
        padding:5px;
        font-size: 0.75em;
        whitespace: nowrap;
      }
      #jellyNotificationIcon{
        width: 18px;
        height: 18px;
        margin-top: auto;
        margin-bottom: auto;
        margin-left: 15px;
      }
    </style>`;
  notificationContainer.innerHTML = notificationString;
  document.getElementById("jellyNotificationIcon").src = chrome.extension.getURL("img/icon.png");
  setTimeout(function(){destroyNotification(notificationContainer);}, timeout);
}

function destroyNotification(notification){
  notification.parentNode.removeChild(notification);
}

function sleep(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}
