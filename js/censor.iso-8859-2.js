/* Skrypt udostepniony na licencji MIT:
 * http://www.opensource.org/licenses/mit-license.php
 */

(function()
{
	var FREQUENCY = 0.15;
	var MIN_CENSORED_LENGTH = 5;
//	var INFO_DIV_CUSTOM_STYLESHEET = 'censor_js_info_div_stylesheet';
//	var INFO_LINK_CUSTOM_STYLESHEET = 'censor_js_info_link_stylesheet';
	var INFO_DIV_CUSTOM_STYLESHEET = '';
	var INFO_LINK_CUSTOM_STYLESHEET = '';
	var INFO_LINK_TEXT = 'Strona ocenzurowana prewencyjnie. Podziêkuj premierowi!';
	var INFO_LINK_HREF = 'http://podziekujpremierowi.pl/';
	var SHOW_ONCE = true;
	var DAYS_TO_EXPIRE = 1;
	var CENSOR_ROOT_CLASS_FILTER = '';
	var CENSOR_SPAN_CLASS = 'censor_js_script_span';
	var CENSOR_INFO_DIV_ID = 'censor_js_script_info_div';
	var CENSOR_COOKIE_NAME = 'censor_js_shown';

	function getXPathNodes(doc, xpath)
	{
		var iterator = doc.evaluate(xpath, doc.body, null,
			XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
		var node = iterator.iterateNext();
		var nodeList = [];
		while (node)
		{
			nodeList.push(node);
			node = iterator.iterateNext();
		}
		return nodeList;
	}

	function getTextNodesIE(element, textNodes)
	{
		if (element.nodeType == 3)
		{
			// text element
			textNodes.push(element);
			return;
		}
		if (!element.tagName || element.tagName.toLowerCase() == 'head')
			return;
		if (CENSOR_ROOT_CLASS_FILTER &&
			((' ' + element.className + ' ').indexOf(' ' + CENSOR_ROOT_CLASS_FILTER + ' ') != -1))
			return;
		for (var i = 0; i < element.childNodes.length; ++i)
			getTextNodesIE(element.childNodes[i], textNodes);
	}

	function getTextNodes(doc)
	{
		if (doc.evaluate)
		{
			if (CENSOR_ROOT_CLASS_FILTER)
			{
				return getXPathNodes(doc, '//text()[not(ancestor::head) and ' +
					'ancestor::*[contains(concat(\' \', @class, \' \'), ' +
					'concat(\' \', \'' + CENSOR_ROOT_CLASS_FILTER + '\', \' \'))]]');
			}
			else
				return getXPathNodes(doc, '//text()[not(ancestor::head)]');
		}
		else
		{
			// IE workaround
			var textNodes = [];
			getTextNodesIE(doc.body, textNodes);
			return textNodes;
		}
	}

	function getCensoredSpanNodes(doc)
	{
		if (doc.evaluate)
		{
			return getXPathNodes(doc, '//span[@class=\'' + CENSOR_SPAN_CLASS + '\']');
		}
		else
		{
			// IE workaround
			var spans = doc.getElementsByTagName('span');
			var censoredSpans = [];
			for (var i = 0; i < spans.length; ++i)
			{
				if (spans[i].className == CENSOR_SPAN_CLASS)
					censoredSpans.push(spans[i]);
			}
			return censoredSpans;
		}
	}

	function injectPlainSpan(doc, parentNode, followingNode, text)
	{
		var node = doc.createTextNode(text);
		if (followingNode)
			parentNode.insertBefore(node, followingNode);
		else
			parentNode.appendChild(node);
	}

	function injectCensoredSpan(doc, parentNode, followingNode, text, protoCensoringSpan)
	{
		var censoringSpan = protoCensoringSpan.cloneNode(false);
		injectPlainSpan(doc, censoringSpan, null, text);
		if (followingNode)
			parentNode.insertBefore(censoringSpan, followingNode);
		else
			parentNode.appendChild(censoringSpan);
	}

	function censorTextNode(doc, textNode, protoCensoringSpan)
	{
		if (!textNode.nodeValue) return;
		var words = textNode.nodeValue.split(/\s+/);
		var parentNode = textNode.parentNode;
		if (!parentNode) return;
		var nextNode = textNode.nextSibling;
		var accumText = '';
		var censoring = false;
		for (var i = 0; i < words.length; ++i)
		{
			if (censoring == (Math.random() < FREQUENCY))
			{
				// still in the same mode, accumulate text
				if (i != 0) accumText += ' ';
				accumText += words[i];
			}
			else
			{
				// mode switch, emit accumulated text
				if (censoring && accumText.length >= MIN_CENSORED_LENGTH)
					injectCensoredSpan(doc, parentNode, nextNode, accumText, protoCensoringSpan);
				else
					injectPlainSpan(doc, parentNode, nextNode, ' ' + accumText + ' ');
				accumText = words[i];
				censoring = !censoring;
			}
		}
		if (accumText != '')
		{
			// end of text node, emit accumulated text
			if (censoring && accumText.length >= MIN_CENSORED_LENGTH)
				injectCensoredSpan(doc, parentNode, nextNode, accumText, protoCensoringSpan);
			else
				injectPlainSpan(doc, parentNode, nextNode, ' ' + accumText + ' ');
		}
		parentNode.removeChild(textNode);
	}

	function createProtoCensoringSpan(doc)
	{
		var element = doc.createElement('span');
		element.className = CENSOR_SPAN_CLASS;
		element.style.backgroundColor = '#000';
		element.style.color = '#000';
		return element;
	}

	function censorDocument(doc)
	{
		var protoCensoringSpan = createProtoCensoringSpan(doc);
		var textNodes = getTextNodes(doc);
		for (var i = 0; i < textNodes.length; ++i)
			censorTextNode(doc, textNodes[i], protoCensoringSpan);
	}

	function censorWindow()
	{
		if (SHOW_ONCE)
		{
			if (readCookie(CENSOR_COOKIE_NAME))
				return;
			createCookie(CENSOR_COOKIE_NAME, true, DAYS_TO_EXPIRE);
		}
		censorDocument(window.document);
		addInfoLayer();
	}

	function uncensorTextNode(doc, censoredSpanNode)
	{
		var parentNode = censoredSpanNode.parentNode;
		if (!parentNode) return;
		for (var i = 0; i < censoredSpanNode.childNodes.length; ++i)
		{
			var childNode = censoredSpanNode.childNodes[i];
			censoredSpanNode.removeChild(childNode);
			parentNode.insertBefore(childNode, censoredSpanNode);
		}
		parentNode.removeChild(censoredSpanNode);
	}

	function uncensorDocument(doc)
	{
		var censoredSpanNodes = getCensoredSpanNodes(doc);
		for (var i = 0; i < censoredSpanNodes.length; ++i)
			uncensorTextNode(doc, censoredSpanNodes[i]);
		removeInfoLayer();
	}

	function uncensorWindow()
	{
		uncensorDocument(window.document);
	}

	function addInfoLayer()
	{
		var doc = window.document;
		var infoDiv = doc.createElement('div');
		infoDiv.id = CENSOR_INFO_DIV_ID;
		if (!INFO_DIV_CUSTOM_STYLESHEET)
		{
			infoDiv.style.position = 'absolute';
			infoDiv.style.top = 0;
			infoDiv.style.left = 0;
			infoDiv.style.zIndex = 9999999;
			infoDiv.style.width = '100%';
			infoDiv.style.textAlign = 'center';
			infoDiv.style.border = 'solid 2px #f00';
			infoDiv.style.backgroundColor = '#000';
			infoDiv.style.fontFamily = 'sans-serif';
			infoDiv.style.color = '#f00';
			infoDiv.style.padding = '5px';
		}
		else
			infoDiv.className = INFO_DIV_CUSTOM_STYLESHEET;
		var infoLink = doc.createElement('a');
		if (!INFO_LINK_CUSTOM_STYLESHEET)
		{
			infoLink.style.color = '#f00';
		}
		else
			infoLink.className = INFO_LINK_CUSTOM_STYLESHEET;
		infoLink.href = INFO_LINK_HREF ? INFO_LINK_HREF : '#';
		infoLink.innerHTML = INFO_LINK_TEXT;
		infoLink.target = '_blank';
		infoLink.onclick = uncensorWindow;
		infoDiv.appendChild(infoLink);
		doc.body.appendChild(infoDiv);
	}

	function removeInfoLayer()
	{
		var infoDiv = window.document.getElementById(CENSOR_INFO_DIV_ID);
		if (infoDiv && infoDiv.parentNode)
			infoDiv.parentNode.removeChild(infoDiv);
	}

	function createCookie(name, value, days)
	{
		if (days)
		{
			var date = new Date();
			date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
			var expires = "; expires=" + date.toGMTString();
		}
		else
			var expires = "";
		document.cookie = name + "="+ value + expires + "; path=/";
	}

	function readCookie(name)
	{
		var nameEQ = name + "=";
		var ca = document.cookie.split(';');
		for(var i = 0; i < ca.length; ++i)
		{
			var c = ca[i];
			while (c.charAt(0) == ' ')
				c = c.substring(1, c.length);
			if (c.indexOf(nameEQ) == 0)
				return c.substring(nameEQ.length, c.length);
		}
		return null;
	}

	function eraseCookie(name)
	{
		createCookie(name, "", -1);
	}

	function registerOnLoadHandler(handler)
	{
		if (window.addEventListener)
		{
			window.addEventListener('load', handler, true);
			return;
		}
		// IE workaround
		var prevOnLoad = window.onload;
		var realHandler = handler;
		if (prevOnLoad)
		{
			realHandler = function()
				{
					prevOnLoad();
					handler();
				};
		}
		window.onload = realHandler;
	}

	registerOnLoadHandler(censorWindow);
})();
