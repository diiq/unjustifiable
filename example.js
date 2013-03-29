$(document).ready(function() {
    var justify = Unjustifiable({
        hyphen_width: 5,
        overhang: 1,
        stretch: 10,
        space: 3
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

    justify.options.hyphen_width = 0;
    justify.options.overhang = 6;

    $(".unjustifiable_hanging").append($(".css").html());
    justify(".unjustifiable_hanging > p");

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
    add_button(".showhanging", ".unjustifiable_hanging");
});