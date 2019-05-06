(function ($) {
    //jQuery.support.cors = true;
    $.ajax({
        // async: false,    
        url: "http://8081.gr002701.23ehgni5.0196bd.grapps.cn/api/list-stations",
        // dataType: 'json',
        type: 'GET',
        // timeout: 5000,
        crossDomain: true,
        dataType: 'jsonp',
        success: function (datas) {
            console.log("datas", datas)
        },
        error: function (err) {
            console.log("err", err)
        },
    });
})(jQuery);