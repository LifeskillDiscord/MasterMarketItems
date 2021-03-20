"use strict";

function marketcustomAjax(formId, ajax) {
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
    }
  });
  return new Promise((resolve, reject) => {
    resolve(result);
  });
}

async function marketloadList(category) {
  const result = await marketcustomAjax("frmGetWorldMarketList", {
    url: "/Home/GetWorldMarketList",
    type: "POST",
    data: {
      mainCategory: category.mainCategory,
      subCategory: category.subCategory
    },
    beforeSend: function (xhr, settings) {},
    complete: function (xhr, status) {},
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
    error: function (xhr, status, error) {}
  });
  return new Promise((resolve, reject) => {
    resolve({
      category: category,
      marketList: result.marketList
    });
  });
}

async function marketloadSubList(categoryItem) {
  const result = await marketcustomAjax("frmGetWorldMarketSubList", {
    url: "/Home/GetWorldMarketSubList",
    type: "POST",
    data: {
      mainKey: categoryItem.mainKey,
      usingCleint: 0
    },
    beforeSend: function (xhr, settings) {},
    complete: function (xhr, status) {},
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
      result.info = arrangeItemInfo(result.detailList);
      result.detailList.forEach(function (item) {
        item.pricePerOne = renderComma(item.pricePerOne);
        item.iconPath = renderThumbUrl(item.mainKey);

        if (1 < _cache.subList.length) {
          if (1 < _cache.subList[1].subKey - _cache.subList[0].subKey) {
            item.name =
              getEnchantString("normal", item) +
              item.name +
              getEnchantString("group", item);
          } else {
            item.name = getEnchantString("normal", item) + item.name;
          }
        }

        item.sumCountText = getResourceValue("TRADE_MARKET_EA").replace(
          "[STR:ITEMCOUNT]",
          result.info.sumCount
        );
        item.countText = getResourceValue("TRADE_MARKET_EA").replace(
          "[STR:ITEMCOUNT]",
          item.count
        );
      });
      return result;
    },
    error: function (xhr, status, error) {}
  });
  return new Promise((resolve, reject) => {
    resolve({
      categoryItem: categoryItem,
      detailList: result.detailList
    });
  });
}

function getCategoryList() {
  var result = [];
  $(".categoryList label ul li").each(function (e) {
    result.push({
      mainLabel: $(this).closest("label").find("span").text(),
      subLabel: $(this).text(),
      mainCategory: $(this).data().main,
      subCategory: $(this).data().sub
    });
    return;
  });
  return result; //.slice(0, 1); // for testing
}

async function getMasterMarketItemsList() {
  // Takes right about 10 minutes to build the full listing.
  const categoryItemLists = await Promise.all(
    getCategoryList().map(async (category) => {
      return marketloadList(category);
    })
  );
  let categoryItems = categoryItemLists
    .map((e) => {
      return e.marketList.map((marketItem) => {
        return { ...e.category, ...marketItem };
      });
    })
    .flat(1);
  const marketItemLists = await categoryItems.reduce(
    async (memo, categoryItem) => {
      const results = await memo;
      const itemDetail = await marketloadSubList(categoryItem);
      return [...results, itemDetail];
    },
    []
  );
  let marketItems = marketItemLists
    .map((e) => {
      return e.detailList.map((itemDetail) => {
        return { ...e.categoryItem, ...itemDetail };
      });
    })
    .flat(1);
  marketItems = marketItems.map((item) => {
    return {
      mainLabel: item.mainLabel,
      subLabel: item.subLabel,
      icon: item.iconPath.replace("url", "=IMAGE"),
      description: item.name,
      activate: false,
      mainCategory: item.mainCategory,
      subCategory: item.subCategory,
      grade: item.grade,
      keyType: item.keyType,
      mainKey: item.mainKey,
      subKey: item.subKey,
      chooseKey: item.chooseKey,
      name: item.name
    };
  });
  return new Promise((resolve, reject) => {
    resolve(marketItems);
  });
}

var masterMarketItemsList;
getMasterMarketItemsList().then((result) => (masterMarketItemsList = result));
