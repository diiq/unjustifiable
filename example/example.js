$(document).ready(function() {
    var justify = Unjustifiable({
        hyphen_width: 0,
        overhang: 8,
        stretch: 10,
    });

    $(".unjustifiable_full").append($(".css").html());
    justify(".unjustifiable_full > p");

    var hypher = new Hypher(Hypher.en);
    var hyphenator = function(word) {
        if (word.length > 6) {
            return hypher.hyphenate(word, "en");
        }
        return [word];
    };

    justify.options.hyphenator = hyphenator;

    $(".unjustifiable_hyphenated").append($(".css").html());
    justify(".unjustifiable_hyphenated > p");

    $(".textblock").hide();
    $(".css").show();
    $(".showcss").addClass("active");
    var add_button = function(butclass, textclass) {
        $(butclass).mouseover(function () {
            $(".textblock").hide();
            $(".button").removeClass("active");
            $(butclass).addClass("active");
            $(textclass).show();
        });
    };
    add_button(".showcss", ".css");
    add_button(".showfull", ".unjustifiable_full");
    add_button(".showhyphen", ".unjustifiable_hyphenated");
});