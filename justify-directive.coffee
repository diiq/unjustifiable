angular.module('diiq')
.directive 'justify', () ->
  hyph = new Hypher(en_us)
  justify = unjustifiable
    hyphenator: (w) -> hyph.hyphenate(w)

  restrict: 'A'
  scope: {}
  link: (scope, element) ->
    element = element[0]
    unjustified = element.innerHTML

    scope.width = ->
      element.getClientRects()[0].width

    scope.$watch "width()", _.debounce(->
      element.style.visibility = "hidden"
      element.innerHTML = unjustified
      justify(element)
      element.style.visibility = "visible"
    , 100)

    angular.element(window).bind 'resize', -> scope.$apply()
