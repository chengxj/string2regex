/*! string2regex - v0.0.1 - 2014-11-18
* Copyright (c) 2014 ; Licensed MIT */

angular.module('string2regex',['ui.bootstrap','string2regex.template'])
.value('String2RegexConfiguration',{
  doCaptureNames: false,
  groupColors:[
    "#F5A9A9",
    "#F3E2A9",
    "#D0F5A9",
    "#A9F5BC",
    "#A9F5F2",
    "#A9BCF5",
    "#D0A9F5",
    "#F5A9E1"
  ],
  classInfo: {
    number: {
      display_button: true,
      button_text: 'Num',
      button_tooltip: 'Number'
    },
    uppercase: {
      display_button: true,
      button_text: 'Up',
      button_tooltip: 'Uppercase'
    },
    lowercase: {
      display_button: true,
      button_text: 'Low',
      button_tooltip: 'Lowercase'
    },
    alphabet: {
      display_button: true,
      button_text: 'Alpha',
      button_tooltip: 'Alphabet'
    },
    alphanumerical: { 
      display_button: true,
      button_text: 'AlNum',
      button_tooltip: 'Alphanumerical'
    },
    space: {
      display_button: true,
      button_text: 'Spac',
      button_tooltip: 'Space'
    },
    nonspace: {
      display_button: true,
      button_text: 'NSpac',
      button_tooltip: 'NonSpace'
    },
    symbol: {
      display_button: true,
      button_text: 'Sym',
      button_tooltip: 'Symbol'
    },
    constant: {
      display_button: true,
      button_text: 'Con',
      button_tooltip: 'Constant'
    },
    linebreak: {
      display_button: true,
      button_text: 'LB',
      button_tooltip: 'Line break'
    },
    any: {
      display_button: true,
      button_text: 'Any',
      button_tooltip: 'Any'
    }
  },
  characterClassFunction: function(char){ // Return an array of string corresponding to the character class.
    var result = [];
    if(char >= '0' && char <= '9'){
      result.push('number');
    }
    if(char >= 'a' && char <= 'z'){
      result.push('lowercase');
    }
    if(char >= 'A' && char <= 'Z'){
      result.push('uppercase');
    }
    if(_.contains(result,'lowercase') || _.contains(result,'uppercase')){
      result.push('alphabet');
    }
    if(_.contains(result,'alphabet') || _.contains(result,'number')){
      result.push('alphanumerical');
    }
    if(char === ' ' || char == "\n"){
      result.push('space');
    }else{
      result.push('nonspace');
    }
    if(char == "\n"){
      result.push('linebreak');
    }
    if(!_.contains(result,'alphanumerical') && !_.contains(result,'space')){
      result.push('symbol');
    }
    result.push('constant');
    result.push('any');
    return result;
  },
  generateRegexPortion: function(charClass,group){ // Generate part of regular expression based on class.
    var mapping = {
      number: '[0-9]',
      lowercase: '[a-z]',
      uppercase: '[A-Z]',
      alphabet: '[a-zA-Z]',
      alphanumerical: '[a-zA-Z0-9]',
      space: '\\s',
      nonspace: '\\S',
      symbol: '[^a-zA-Z0-9]',
      linebreak: '\\n',
      any: '.'
    };
    if(mapping[charClass] !== undefined){
      return mapping[charClass];
    }else if( charClass === 'constant' ){
      return (group.string+'').replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1").replace("\n","\\n"); // quite it from being a regular expression.
    }else if( charClass === 'any' ){
      return '.';
    }
    return 'ERROR unknown charClass '+charClass;
  },
  defaultClass: 'any'
})
.controller('String2RegexCtrl',['$scope','String2RegexConfiguration',function($scope,String2RegexConfiguration){
  var holder = $scope.holder;
  _.defaults(holder,{
    sample: '',
    regex: '',
    startAnchor: true,
    endAnchor: true
  });
  var groupColors = String2RegexConfiguration.groupColors;
  var getCharacterClass = _.memoize(String2RegexConfiguration.characterClassFunction);
  var defaultClass = String2RegexConfiguration.defaultClass;
  var generateRegexPortion = String2RegexConfiguration.generateRegexPortion;

  // List of properties that is considered as state 
  // These are used in serialization and preserveSettingFromOldGroup
  var groupStateProperties = [ 
    'multiplier',              
    'multiplier_min',
    'multiplier_max',
    'multiplier_constant',
    'do_capture',
    'capture_name',
    'selectedClass'
  ]; 

  // List of properties that is used in preserveSettingFromOldGroup
  var preservableGroupStateProperties = _.difference(groupStateProperties,[ 
    'do_capture', // Don't preserve do_capture.
    'capture_name'
  ]);

  $scope.classInfo = String2RegexConfiguration.classInfo;

  // common class is character class which every character in the string have.
  function getCommonCharacterClass(string){
    var commonClass = getCharacterClass(string[0]);
    for(var i=1;i<string.length;i++){
      var cclass = getCharacterClass(string[i]);
      commonClass = _.intersection(cclass,commonClass);
    }
    return commonClass;
  }

  // generate child groups.
  function generateChildGroups(string, depth){
    if( depth === undefined ){
      depth = 0;
    }

    // if string length is 1 or less, no need to find child.
    if(string.length <= 1){
      return [];
    }

    var groups = [];

    var commonClass = getCommonCharacterClass(string);
    var curClass = _.difference(getCharacterClass(string[0]),commonClass); //The first character class excluding common class
    var curStart = 0;
    var substr = '';
    for(var i=1;i<string.length;i++){
      var cchar = string[i];
      var ccurClass = _.difference(getCharacterClass(string[i]),commonClass); //current character class excluding common class
      if(_.intersection(ccurClass,curClass).length === 0){ // they are not of the same set.
        substr = string.substring(curStart,i);
        groups.push(generateGroup(substr, depth));
        curClass = ccurClass;
        curStart = i;
      }else{
        curClass = _.intersection(ccurClass,curClass);
      }
    }

    if(curStart === 0){
      //The whole string have the same group.
      console.log("Apparently same group");
      return [];
    }
    substr = string.substring(curStart,string.length); // last substr
    groups.push(generateGroup(substr, depth));

    return groups;
  }

  function generateGroup(string, depth){
    if( depth === undefined ){ //Depth is the depth from topmost parent.
      depth = 0;
    }

    var group={
      string: string,
      multiplier: 'omore', // Set default multiplier
      multiplier_min: 1,
      multiplier_max: 10,
      multiplier_constant: 1,
      do_capture: false,
      capture_name: '',
      commonClass: getCommonCharacterClass(string, depth),
      depth: depth,
      selectedClass: '', // Which class should output in regular expression?
      getSize: function(){
        return this.string.length;
      },
      getGroupColor: function(){
        return getColorForDepth(this.depth);
      },
      hasSelected: function(){
        if(this.selectedClass !== ''){
          return true;
        }
        var selectedChild = _.find(this.childs,function(child){ return child.hasSelected(); });
        return selectedChild !== undefined;
      },
      ensureSelection: function(parent){ 
        // If any child is selected, this cannot be selected. 
        // If any child is selected, all child must be selected.
        // If none of the child is selected, then this must be selected.
        // Also, pass parent to change child setting.
        // Used to hint what class to put when the parent need to fill unselected child
        // with the parent's class properties.

        if(_.any(this.childs,function(child){
          return child.hasSelected();
        })){
          if(parent !== undefined){
            _.extend(this,_.pick(parent,'selectedClass','multiplier','multipler_constant','multiplier_min','multiplier_max'));
          } // Do this, so child have something to inherit.
          if( this.selectedClass === ''){
            this.selectedClass = defaultClass; // if parent does not have selectedClass
          }
          var self = this;
          _.each(this.childs,function(child){
            child.ensureSelection(self);
          });
          this.selectedClass = '';
        }else{
          // no child selected
          if(this.selectedClass === ''){
            if(parent !== undefined){
              _.extend(this,_.pick(parent,'selectedClass','multiplier','multipler_constant','multiplier_min','multiplier_max'));
            }
            if( this.selectedClass === ''){
              this.selectedClass = defaultClass; // if parent does not have selectedClass
            }
          }
        }
      },
      ensureNoSelection: function(){
        // This and all child should not be selected.
        this.selectedClass = '';
        _.each(this.childs,function(child){
          child.ensureNoSelection();
        });
      },
      select: function(characterClass){ 
        // Select a characterClass from this group.
        if(characterClass === ''){
          return;
        }
        this.ensureNoSelection();
        this.selectedClass = characterClass;

        if(characterClass == 'constant'){ // auto set multipler to {1} on constant
          this.multiplier = 'constant';
          this.multiplier_constant = 1;
        }

        $scope.rootGroup.ensureSelection();
        regenerateResult();
      },
      generateRegexPartitions: function(){
        // Basically get array of groups with resulting regular expression portion.
        // Used for processing when regex is same between neighbour group.
        var res = [];
        if(this.selectedClass === ''){
          _.each(this.childs,function(child){
            res = res.concat(child.generateRegexPartitions());
          });
        }else{
          res.push({
            regex: generateRegexPortion(this.selectedClass, this), //Obtained from configuration
            group: this
          });
        }
        return res;
      },
      generateGroupedRegexPartitions: function(){
        var partitions = this.generateRegexPartitions();

        // Group by same regex
        // Or if no capture.
        var groupedPartition = [];
        var cur = {
          regex:partitions[0].regex,
          do_capture:partitions[0].group.do_capture,
          capture_name:partitions[0].group.capture_name,
          list:[partitions[0]]
        };
        var i;
        for(i=1;i<partitions.length;i++){
          var cpart = partitions[i];
          if(cpart.regex === cur.regex && !(cur.do_capture || cpart.group.do_capture )){
            cur.list.push(cpart);
          }else{
            groupedPartition.push(cur);
            cur = {
              regex:partitions[i].regex,
              do_capture:partitions[i].group.do_capture,
              capture_name:partitions[i].group.capture_name,
              list:[partitions[i]]
            };
          }
        }
        groupedPartition.push(cur);
        return groupedPartition;

      },
      generateTaggedRegex: function(){
        // Generate HTML of the regular expression.
        var res = {items:[]};
        var i;
        var groupedPartition = this.generateGroupedRegexPartitions();
        if(groupedPartition.length === 0){
          return res;
        }


        // Generate regex according to groupedPartition. 
        // If one of the multiplier is omore, then merge them all. (in a group)
        // If one of the multiplier is zmore, then merge them all. (in a group)
        // Then just merge them.
        for(i=0;i<groupedPartition.length;i++){
          var cgroupedPartition = groupedPartition[i];

          var partition = {items:[]};
          partition.do_capture = cgroupedPartition.do_capture;

          if(_.some(cgroupedPartition.list,function(part){
            return part.group.multiplier == 'omore';
          })){
            partition.items.push({
              expression: cgroupedPartition.regex,
              multiplier: '+'
            });
          }else if(_.some(cgroupedPartition.list,function(part){
            return part.group.multiplier == 'zmore';
          })){
            partition.items.push({
              expression: cgroupedPartition.regex,
              multiplier: '*'
            });
          }else{
            //merge them one by one.
            _.each(cgroupedPartition.list,function(part){
              if(part.group.multiplier == 'constant'){
                if(part.group.multiplier_constant == 1){
                  partition.items.push({
                    expression: cgroupedPartition.regex,
                    multiplier: ''
                  });
                }else{
                  partition.items.push({
                    expression: cgroupedPartition.regex,
                    multiplier: '{'+part.group.multiplier_constant+'}'
                  });
                }
              }else if(part.group.multiplier == 'optional'){
                partition.items.push({
                  expression: cgroupedPartition.regex,
                  multiplier: '?'
                });
              }else if(part.group.multiplier == 'range'){
                partition.items.push({
                  expression: cgroupedPartition.regex,
                  multiplier: '{'+part.group.multiplier_min+','+part.group.multiplier_max+'}'
                });
              }
            });
          }

          res.items.push(partition);

        }

        res.startAnchor = holder.startAnchor;
        res.endAnchor = holder.endAnchor;

        return res;
      },
      convertTaggedRegexToString: function(obj){
        var res = '';
        if(obj.startAnchor){
          res += '^';
        }
        if(obj.do_capture){
          res += '(';
        }
        var self = this;
        _.each(obj.items,function(item){
          if(item.items !== undefined){
            res += self.convertTaggedRegexToString(item); // nested 
          }else{
            res += item.expression+item.multiplier;
          }
        });
        if(obj.do_capture){
          res += ')';
        }
        if(obj.endAnchor){
          res += '$';
        }
        return res;
      },
      generateRegex: function(){
        // Return a regex string.
        var tagged = this.generateTaggedRegex();
        return this.convertTaggedRegexToString(tagged);
      }, 
      preserveSettingFromOldGroup: function(group){
        // attempt to regain setting from old group.
        var self = this;
        _.each(preservableGroupStateProperties,function(val){
          self[val] = group[val];
        });

        // The rest if to see if any child from group is of equal commonClass
        // If so, call preserveSetting from them.
        function childEqual(g1,g2){
          // consider equal if same common class.
          return _.intersection(g1.commonClass,g2.commonClass).length == g1.commonClass.length; 
        }
        var commonChilds = findLCS(group.childs,this.childs,childEqual);

        var ccindex = 0;
        for(var i=0;i<this.childs.length;i++){
          if(ccindex >= commonChilds.length){
            break;
          }
          if(childEqual(this.childs[i],commonChilds[ccindex])){
            this.childs[i].preserveSettingFromOldGroup(commonChilds[ccindex]);
            ccindex++;
          }
        }
      },
      regenerateResult: function(){ // A proxy, so that the dialog can call regenerateResult()
        regenerateResult();
      },
      childs: generateChildGroups(string, depth+1)
    };

    return group;
  }

  function getColorForDepth(depth){
    return groupColors[depth%groupColors.length];
  }

  // return list of active capture_name
  function generateCaptureNameMapping(){
    var groupedPartitions = $scope.rootGroup.generateGroupedRegexPartitions();
    return _.chain(groupedPartitions)
      .filter(function(part){ return part.do_capture; })
      .map(function(part){return part.capture_name; })
      .value();
  }

  function regenerateResult(){
    $scope.holder.taggedregex = $scope.rootGroup.generateTaggedRegex();
    $scope.holder.regex = $scope.rootGroup.generateRegex();
  }

  // A generic longest common subsequence
  // list1 and list2 is self explanatory.
  // is_equal is a function that determine if item is equal.
  function findLCS(list1,list2,is_equal){
    var max = [];
    var ops = [];
    var rows = [];
    var i;
    var i2;
    for(i=0;i<list2.length;i++){
      rows.push(0);
    }
    for(i=0;i<list1.length;i++){
      max.push(angular.copy(rows));
      ops.push(angular.copy(rows));
    }

    for(i=0;i<list1.length;i++){
      for(i2=0;i2<list2.length;i2++){
        if(i===0 || i2===0){
          if( is_equal(list1[i], list2[i2]) ){
            max[i][i2] = 1;
            ops[i][i2] = 1;
          }else if(i===0){
            ops[i][i2] = 3;
          }else if(i2===0){
            ops[i][i2] = 2;
          }
        }else{
          if( is_equal(list1[i], list2[i2]) ){
            max[i][i2] = max[i-1][i2-1]+1;
            ops[i][i2] = 1;
          }else{
            if(max[i-1][i2] > max[i][i2]){
              max[i][i2] = max[i-1][i2];
              ops[i][i2] = 2;
            }
            if(max[i][i2-1] > max[i][i2]){
              max[i][i2] = max[i][i2-1];
              ops[i][i2] = 3;
            }
          }
        }
      }
    }

    var result = [];

    i=list1.length-1;
    i2=list2.length-1;
    while(i != -1 && i2 != -1){
      var op = ops[i][i2];
      if(op == 1){
        result.push(list1[i]);
        i--;
        i2--;
      }
      if(op == 2){
        i--;
      }
      if(op == 3){
        i2--;
      }
      if(op === 0){
        break;
      }
    }

    result.reverse();
    return result;
  }

  // A function that apply serialized property of group 
  // the property should be obtained from serializeGroup
  function applySerializedGroupData(data,group){
    if(group.string != data.string || data.childs.length != group.childs.length){
      //When this happen, just log warning, and quietly fail.
      console.warn('Serialized group string mismatch!');
      return;
    }

    _.each(groupStateProperties,function(prop){
      group[prop] = data[prop];
    });

    for(var i=0;i<data.childs.length;i++){
      applySerializedGroupData(data.childs[i],group.childs[i]);
    }
  }

  // A function that create an object that can be safely
  // converted to JSON and the reapply back to the group using
  // applySerializedGroupData
  function serializeGroup(group){
    var obj = {};
    _.each(groupStateProperties,function(prop){
      obj[prop] = group[prop];
    });
    obj.string = group.string;

    obj.childs = _.map(group.childs,function(child){
      return serializeGroup(child);
    });
    return obj;
  }

  // If sample change, rebuild group and try to preserve state.
  $scope.$watch('holder.sample',function(){
    var oldRoot = $scope.rootGroup;
    $scope.rootGroup = generateGroup(holder.sample);
    $scope.rootGroup.preserveSettingFromOldGroup(oldRoot);
    $scope.rootGroup.ensureSelection();
    regenerateResult();
  });

  // If start or endAnchor change, regenerate result.
  $scope.$watch('holder.startAnchor',function(){
    regenerateResult();
  });
  $scope.$watch('holder.endAnchor',function(){
    regenerateResult();
  });

  // If the serialized rootGroup in the holder change, 
  // try to apply state to current group.
  $scope.$watch('holder.rootGroup',function(){
    if(holder.rootGroup !== undefined){
      applySerializedGroupData(holder.rootGroup,$scope.rootGroup);
      regenerateResult();
    }
  });

  // If the rootGroup change, serialize it to holder's rootGroup
  $scope.$watch('rootGroup',function(){
    if(String2RegexConfiguration.doCaptureNames){
      holder.captureNames = generateCaptureNameMapping();
    }
    holder.rootGroup = serializeGroup($scope.rootGroup);
  },true);

  $scope.rootGroup = generateGroup(holder.sample);
  $scope.rootGroup.ensureSelection();
  regenerateResult();


  $scope.serializeGroup = serializeGroup;
  $scope.applySerializedGroupData = applySerializedGroupData;
  $scope.getCharacterClass = getCharacterClass;
  $scope.findLCS = findLCS;
  $scope.getCommonCharacterClass = getCommonCharacterClass;
  $scope.generateChildGroups = generateChildGroups;
  $scope.generateGroup = generateGroup;
  $scope.regenerateResult = regenerateResult;
  $scope.getColorForDepth = getColorForDepth;
} ])

.controller('String2RegexGroupEditorCtrl',['$scope','group','$modalInstance','String2RegexConfiguration',function($scope,group,$modalInstance,String2RegexConfiguration){
  var editableProperties = [
    'multiplier',              
    'multiplier_min',
    'multiplier_max',
    'multiplier_constant',
    'do_capture',
    'capture_name',
    'selectedClass'
  ];

  var fakegroup = {};
  _.each(editableProperties,function(prop){
    fakegroup[prop] = group[prop];
  });

  this.save = function(){
    if(!$scope.mainform.$valid){
      $scope.mainform.$setDirty();
      return;
    }
    _.each(editableProperties,function(prop){
      group[prop] = fakegroup[prop];
    });
    group.select( fakegroup.selectedClass );
    group.regenerateResult();
    $modalInstance.close();
  };

  this.close = function(){
    $modalInstance.close();
  };

  this.group = fakegroup;
  $scope.group = fakegroup;
  $scope.origroup = group;
  $scope.classInfo = String2RegexConfiguration.classInfo;
  $scope.doCaptureNames = String2RegexConfiguration.doCaptureNames;
}])

.directive('string2regex',[function(){
  return {
    scope: {
      holder: '=string2regex'
    },
    controller: 'String2RegexCtrl',
    link: function(scope, element, attrs, controllers){
    },
    templateUrl: 'string2regex.tpl.html'
  };
}])
.directive('string2regexGroup',['RecursionHelper','$modal',function(RecursionHelper, $modal){

  return {
    scope: {
      group: '=string2regexGroup'
    },
    controller: ['$scope','String2RegexConfiguration',function($scope,String2RegexConfiguration){
      $scope.classInfo = String2RegexConfiguration.classInfo;
      $scope.openEditor = function( group ){
        $modal.open({
          templateUrl: 'string2regex-groupeditor.tpl.html',
          controller: 'String2RegexGroupEditorCtrl',
          controllerAs: 'editor',
          resolve:{
            group: function(){ return group; }
          }
        });
      };
    }],
    link: function(scope, element, attrs, controllers){
    },
    compile: function(element) {
      // Use the compile function from the RecursionHelper,
      // And return the linking function(s) which it returns
      return RecursionHelper.compile(element);
    },
    templateUrl: 'string2regex-group.tpl.html'
  };
}])
.directive('string2regexPrettyregex',['RecursionHelper',function(RecursionHelper){
  return {
    scope:{
      tagged_regex: '=string2regexPrettyregex'
    },
    templateUrl: 'string2regex-prettyregex.tpl.html',
    controller: ['$scope',function($scope){
      $scope._ = _;
    }],
    compile: function(element) {
      // Use the compile function from the RecursionHelper,
      // And return the linking function(s) which it returns
      return RecursionHelper.compile(element);
    },
  };
}])
.directive('string2regexPrettyregexGroup',['RecursionHelper',function(RecursionHelper){
  return {
    scope:{
      tagged_regex: '=string2regexPrettyregexGroup'
    },
    templateUrl: 'string2regex-prettyregex-group.tpl.html',
    controller: ['$scope',function($scope){
      $scope._ = _;
    }],
    compile: function(element) {
      // Use the compile function from the RecursionHelper,
      // And return the linking function(s) which it returns
      return RecursionHelper.compile(element);
    },
  };
}])
//Copied from StackOverflow
.factory('RecursionHelper', ['$compile', function($compile){
    return {
        /** 
         * Manually compiles the element, fixing the recursion loop.
         * @param element
         * @param [link] A post-link function, or an object with function(s) registered via pre and post properties.
         * @returns An object containing the linking functions.
         */
        compile: function(element, link){
            // Normalize the link parameter
            if(angular.isFunction(link)){
                link = { post: link };
            }

            // Break the recursion loop by removing the contents
            var contents = element.contents().remove();
            var compiledContents;
            return {
                pre: (link && link.pre) ? link.pre : null,
                /**
                 * Compiles and re-adds the contents
                 */
                post: function(scope, element){
                    // Compile the contents
                    if(!compiledContents){
                        compiledContents = $compile(contents);
                    }
                    // Re-add the compiled contents to the element
                    compiledContents(scope, function(clone){
                        element.append(clone);
                    });

                    // Call the post-linking function, if any
                    if(link && link.post){
                        link.post.apply(null, arguments);
                    }
                }
            };
        }
    };
}])
.directive('ngMin', [function() { // Fix angular's broken ng-min
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, elem, attr, ctrl) {
      function isEmpty(value) {
        return angular.isUndefined(value) || value === '' || value === null || value !== value;
      }
      scope.$watch(attr.ngMin, function(){
        ctrl.$setViewValue(ctrl.$viewValue);
      });
      var minValidator = function(value) {
        var min = scope.$eval(attr.ngMin) || 0;
        if (!isEmpty(value) && value < min) {
          ctrl.$setValidity('ngMin', false);
          return undefined;
        } else {
          ctrl.$setValidity('ngMin', true);
          return value;
        }
      };

      ctrl.$parsers.push(minValidator);
      ctrl.$formatters.push(minValidator);
    }
  };
}])
.directive('ngMax', [function() { // Fix Angular's broken max
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, elem, attr, ctrl) {
      function isEmpty(value) {
        return angular.isUndefined(value) || value === '' || value === null || value !== value;
      }
      scope.$watch(attr.ngMax, function(){
        ctrl.$setViewValue(ctrl.$viewValue);
      });
      var maxValidator = function(value) {
        var max = scope.$eval(attr.ngMax) || Infinity;
        if (!isEmpty(value) && value > max) {
          ctrl.$setValidity('ngMax', false);
          return undefined;
        } else {
          ctrl.$setValidity('ngMax', true);
          return value;
        }
      };

      ctrl.$parsers.push(maxValidator);
      ctrl.$formatters.push(maxValidator);
    }
  };
}]);


angular.module('string2regex.template', ['string2regex-group.tpl.html', 'string2regex-groupeditor.tpl.html', 'string2regex-prettyregex-group.tpl.html', 'string2regex-prettyregex.tpl.html', 'string2regex.tpl.html']);

angular.module("string2regex-group.tpl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("string2regex-group.tpl.html",
    "<table ng-if=\"group !== undefined\" class=\"group-table\" style=\"background-color: {{ group.getGroupColor()}}\">\n" +
    "      <tbody>\n" +
    "        <tr ng-if=\"group.childs.length == 0\">\n" +
    "          <td colspan=\"{{ group.string.length }}\">\n" +
    "            <div class=\"char-block\"><span ng-if='group.string == \"\\n\"'>\\n</span><span>{{ group.string }}</span></div>\n" +
    "          </td>\n" +
    "        </tr>\n" +
    "        <tr ng-if=\"group.childs.length>=1\">\n" +
    "          <td ng-repeat=\"child in group.childs\" colspan=\"{{ child.string.length }}\">\n" +
    "            <div string2regex-group=\"child\" />\n" +
    "          </td>\n" +
    "        </tr>\n" +
    "        <tr>\n" +
    "          <td colspan=\"{{ group.string.length }}\">\n" +
    "            <div ng-repeat=\"class in group.commonClass\" ng-if=\"classInfo[class].display_button || class == group.selectedClass\" ng-class=\" class == group.selectedClass ? ['class-icon','selected','btn','btn-xs','btn-primary'] : ['class-icon','btn','btn-xs','btn-default'] \" ng-click=\"group.select(class)\" title=\"{{classInfo[class].button_tooltip}}\">\n" +
    "              {{ classInfo[class].button_text }}\n" +
    "            </div>\n" +
    "            <div class=\"btn btn-xs btn-default\" ng-click=\"openEditor(group)\"><span class=\"glyphicon glyphicon-cog\" /></div>\n" +
    "          </td>\n" +
    "        </tr>\n" +
    "      </tbody>\n" +
    "    </table>\n" +
    "");
}]);

angular.module("string2regex-groupeditor.tpl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("string2regex-groupeditor.tpl.html",
    "<div class=\"modal-header\">\n" +
    "      <h3 class=\"modal-title\">Group Options</h3>\n" +
    "    </div>\n" +
    "      <form name='mainform' ng-submit=\"editor.save()\">\n" +
    "    <div class=\"modal-body\">\n" +
    "      <label>String:</label> <pre>{{ origroup.string }}</pre>\n" +
    "        <div class=\"form-group\">\n" +
    "          <label>Available Class: </label><br />\n" +
    "          <span ng-repeat=\"class in origroup.commonClass\">\n" +
    "            <span ng-class=\" class == group.selectedClass ? ['class-icon','selected','btn','btn-sm','btn-primary'] : ['class-icon','btn','btn-sm','btn-default'] \" ng-click=\" group.selectedClass = class \" title=\"{{classInfo[class].button_tooltip}}\">\n" +
    "              {{ classInfo[class].button_text }}\n" +
    "            </span>\n" +
    "          </span>\n" +
    "        </div>\n" +
    "\n" +
    "        <div class=\"row\">\n" +
    "          <div class=\"col-xs-4\">\n" +
    "            <div class=\"form-group\">\n" +
    "              <label>Multiplier: </label>\n" +
    "              <select ng-model=\"group.multiplier\" class=\"form-control\" required>\n" +
    "                <option value=\"constant\">Constant</option>\n" +
    "                <option value=\"range\">Range</option>\n" +
    "                <option value=\"omore\">One or more (+)</option>\n" +
    "                <option value=\"zmore\">Zero or more (*)</option>\n" +
    "                <option value=\"optional\">Optional one (?)</option>\n" +
    "              </select>\n" +
    "            </div>\n" +
    "          </div>\n" +
    "          <div ng-if=\"group.multiplier == 'constant'\">\n" +
    "            <div class=\"form-group col-xs-8\">\n" +
    "              <label> Multiplier value: </label>\n" +
    "              <input type=\"number\" class=\"form-control\" ng-model=\"group.multiplier_constant\" min=\"1\" ng-required=\"group.multiplier == 'constant'\"></input>\n" +
    "            </div>\n" +
    "          </div>\n" +
    "          <div ng-if=\"group.multiplier == 'range'\">\n" +
    "            <div class=\"form-group col-xs-4\">\n" +
    "              <label> Multiplier Min: </label>\n" +
    "              <input type=\"number\" class=\"form-control\" ng-model=\"group.multiplier_min\" min=\"1\" ng-max=\"{{group.multiplier_max}}\" ng-required=\"group.multiplier == 'range'\"></input>\n" +
    "            </div>\n" +
    "            <div class=\"form-group col-xs-4\">\n" +
    "              <label> Multiplier Max: </label>\n" +
    "              <input type=\"number\" class=\"form-control\" ng-model=\"group.multiplier_max\" min=\"{{group.multiplier_min}}\" ng-min=\"{{group.multiplier_min}}\" ng-required=\"group.multiplier == 'range'\"></input>\n" +
    "            </div>\n" +
    "          </div>\n" +
    "        </div>\n" +
    "\n" +
    "        <div class=\"checkbox\">\n" +
    "          <label>\n" +
    "            <input type=\"checkbox\" ng-model=\"group.do_capture\"/> Capture Component\n" +
    "          </label>\n" +
    "        </div>\n" +
    "        <div ng-if=\"group.do_capture && doCaptureNames\">\n" +
    "          <label> Capture Name: </label>\n" +
    "          <input type=\"text\" class=\"form-control\" ng-model=\"group.capture_name\" ng-required=\"group.do_capture\"></input>\n" +
    "        </div>\n" +
    "\n" +
    "        <div class=\"clearfix\" />\n" +
    "\n" +
    "    </div>\n" +
    "    <div class=\"modal-footer\">\n" +
    "      <div ng-class=\"'btn btn-default'\" ng-click=\"editor.close()\">Close</div>\n" +
    "      <button ng-class=\"'btn btn-primary'\">Save</button>\n" +
    "    </div>\n" +
    "      </form>\n" +
    "");
}]);

angular.module("string2regex-prettyregex-group.tpl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("string2regex-prettyregex-group.tpl.html",
    "<span ng-class=\"{ 'capture-group':tagged_regex.do_capture, group: true }\">\n" +
    "    <span ng-if=\"tagged_regex.do_capture\" class=\"capture-parenthesis capture-start\">(</span>\n" +
    "    <span ng-repeat=\"part in tagged_regex.items\">\n" +
    "        <span ng-if=\"part.items !== undefined\">\n" +
    "            <span string2regex-prettyregex-group=\"part\"></span>\n" +
    "        </span>\n" +
    "        <span ng-if=\"part.items === undefined\">\n" +
    "            <span class=\"expression\">{{ part.expression }}</span>\n" +
    "            <span class=\"multiplier\">{{ part.multiplier }}</span>\n" +
    "        </span>\n" +
    "    </span>\n" +
    "    <span ng-if=\"tagged_regex.do_capture\" class=\"capture-parenthesis capture-end\">)</span>\n" +
    "</span>\n" +
    "");
}]);

angular.module("string2regex-prettyregex.tpl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("string2regex-prettyregex.tpl.html",
    "<span class=\"string2regex-prettyregex\">\n" +
    "    <span ng-if=\"tagged_regex.startAnchor\" class=\"start-anchor\">^</span>\n" +
    "    <span string2regex-prettyregex-group=\"tagged_regex\"></span>\n" +
    "    <span ng-if=\"tagged_regex.endAnchor\" class=\"end-anchor\">$</span>\n" +
    "</span>\n" +
    "");
}]);

angular.module("string2regex.tpl.html", []).run(["$templateCache", function($templateCache) {
  $templateCache.put("string2regex.tpl.html",
    "<div class=\"string2regex\">\n" +
    "      <div class=\"string2regex-table\">\n" +
    "        <div string2regex-group=\"rootGroup\" />\n" +
    "      </div>\n" +
    "    </div>\n" +
    "");
}]);
