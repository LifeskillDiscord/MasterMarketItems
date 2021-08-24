async function marketAjax(formId, ajax) {
  pending(true);

  if ($.isEmptyObject(ajax) && isEmpty(ajax)) {
    pending(false);
    console.error("data error!");
    return;
  }
  var data = {};

  var $frm = $("#" + formId);
  if ($frm.length <= 0) {
    data = ajax.data || {};
  } else {
    setHiddenField($frm, ajax.data);
    data = $frm.serializeArray();
  }
  if (0 < data.length) {
    var removeCommaList = ["buyCount", "sellCount"];
    data.forEach(function (item) {
      if (0 <= removeCommaList.indexOf(item.name)) {
        item.value = removeComma(item.value || "");
      }
    });
  }

  var result = $.ajax({
    url: ajax.url,
    data: data,
    type: ajax.type,
    xhrFields: ajax.xhrFields,
    beforeSend: function (xhr, settings) {
      if ($.isFunction(ajax.beforeSend)) {
        ajax.beforeSend(xhr, settings);
      }
    },
    complete: function (xhr, status) {
      if ($.isFunction(ajax.complete)) {
        ajax.complete(xhr, status);
      }
      pending(false);
    },
    success: function (result, status, xhr) {
      if ($.isFunction(ajax.success)) {
        ajax.success(result, status, xhr);
      }

      if (result.resultCode != 0) {
        switch (result.resultCode) {
          case 2000:
            window.location = result.redirectUrl;
            break;
        }
        return result;
      }
    },
    error: function (xhr, status, error) {
      if ($.isFunction(error.beforeSend)) {
        error.beforeSend(xhr, status, error);
      }
      console.log(error);
    },
  });
  return result;
}

async function loadCategoryList(category) {
  const result = await marketAjax("frmGetWorldMarketList", {
    url: "/Home/GetWorldMarketList",
    type: "POST",
    data: {
      mainCategory: category.mainCategory,
      subCategory: category.subCategory,
    },
    beforeSend: function (xhr, settings) { },
    complete: function (xhr, status) { },
    success: function (result, status, xhr) {
      if (result.resultCode != 0) {
        if (result.resultCode == -8745) {
          window.location = result.resultMsg;
          return;
        }
        alert(getResourceValue(result.resultMsg));
        return;
      }
      if (!result.marketList) {
        return;
      }
      _cache.marketList = result.marketList.slice();
      return result.marketList.slice();
    },
    error: function (xhr, status, error) { },
  });
  return { category: category, marketList: result.marketList };
}

async function loadItemList(categoryItem) {
  const tradeResult = await marketAjax("frmGetWorldMarketSubList", {
    url: "/Trademarket/GetWorldMarketSubList",
    type: "POST",
    data: { mainKey: categoryItem.mainKey, keyType: 0 },
    beforeSend: function (xhr, settings) { },
    complete: function (xhr, status) { },
    success: function (result, status, xhr) {
      if (result.resultCode != 0) {
          alert(getResourceValue(result.resultMsg));
          return;
      }
      if (!result.resultMsg) {
          return;
      }
      return result.resultMsg
    },
    error: function (xhr, status, error) { }
  });
  let tradeDetails = await tradeResult.resultMsg.split("|").filter(x => x)
    .map(detail => detail.split("-"))
    .map((values) => {return {minCap: values[6], maxCap: values[7]} })

  const marketResult = await marketAjax("frmGetWorldMarketSubList", {
    url: "/Home/GetWorldMarketSubList",
    type: "POST",
    data: { mainKey: categoryItem.mainKey, usingCleint: 0 },
    beforeSend: function (xhr, settings) { },
    complete: function (xhr, status) { },
    success: function (result, status, xhr) {
      if (result.resultCode != 0) {
        alert(getResourceValue(result.resultMsg));
        return;
      }
      if (!result.detailList) {
        return;
      }
      $(".sortFilter").hide();
      _cache.subList = result.detailList.slice();
      result.detailList.forEach(function (item, i) {
        item.iconPath = renderThumbUrl(item.mainKey);
        item.description = item.name;
        if (1 < _cache.subList.length) {
          if (1 < _cache.subList[1].subKey - _cache.subList[0].subKey) {
            item.description =
              getEnchantString("normal", item) +
              item.description +
              getEnchantString("group", item);
          } else {
            item.description =
              getEnchantString("normal", item) + item.description;
          }
        }
        item.minCap = tradeDetails[i].minCap;
        item.maxCap = tradeDetails[i].maxCap;
      });
      return result;
    },
    error: function (xhr, status, error) { },
  });
  return { categoryItem: categoryItem, detailList: marketResult.detailList };
}

function spreadmergeItemLists(itemLists) {
  return itemLists
    .map((e) => {
      let keys = Object.keys(e);
      return e[keys[1]].map((el) => {
        return { ...e[keys[0]], ...el };
      });
    })
    .flat(1);
}

async function arrangeMarketItemInfo(marketItems) {
  return marketItems.map((item) => {
    return {
      mainLabel: item.mainLabel,
      subLabel: item.subLabel,
      icon: item.iconPath.replace("url", "=IMAGE"),
      description: item.description,
      minCap: item.minCap,
      maxCap: item.maxCap,
      activate: false,
      mainCategory: item.mainCategory,
      subCategory: item.subCategory,
      grade: item.grade,
      keyType: item.keyType,
      mainKey: item.mainKey,
      subKey: item.subKey,
      chooseKey: item.chooseKey,
      name: item.name,
    };
  });
}

function getCategoryList() {
  let result = [];
  document.querySelectorAll(".categoryList label li").forEach((li) => {
    result.push({
      mainLabel: li.parentNode.parentNode.querySelector("span").innerText,
      subLabel: li.innerText,
      mainCategory: li.dataset.main,
      subCategory: li.dataset.sub,
    });
  });
  return result; // .slice(0, 1); // for testing
}

async function getCategoryItems() {
  return Promise.all(
    getCategoryList().map(async (category) => {
      return loadCategoryList(category);
    })
  )
    .then(spreadmergeItemLists)
}

async function getMarketItems() {
  return getCategoryItems()
    .then((categoryItems) =>
      categoryItems.reduce(async (memo, item) => {
        const results = await memo;
        const itemList = await loadItemList(item);
        return [...results, itemList];
      }, [])
    )
    .then(spreadmergeItemLists)
    .then(arrangeMarketItemInfo);
}

var marketItems;
var t0 = performance.now();
getMarketItems()
  .then((result) => (marketItems = result))
  .then((result) => {
    var t1 = performance.now();
    let elapsedTime = new Date(t1 - t0).toISOString().slice(11, -1);
    console.log(
      "Completed in " + elapsedTime + " with: " + result.length + " rows."
    );
  });
