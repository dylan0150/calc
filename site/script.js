var app = angular.module('app',[])

app.controller('mainCtrl', function($scope, $http, $filter){

  var host = 'http://localhost:8080'

  $scope.loading = true

  $scope.view = 'info'

  var parseDates = function(obj) {
    if (Array.isArray(obj)) {
      for (var i = 0; i < obj.length; i++) {
        parseDates(obj[i])
      }
    } else {
      for (var key in obj) {
        if (key == 'date' || key == 'next_date' || key == 'completion_date' || key == 'from') {
          obj[key] = new Date(obj[key])
        } else if (typeof obj[key] == 'object') {
          parseDates(obj[key])
        }
      }
    }
  }

  var load = function() {
    return $http({
      method:'get',
      url:host+'/load'
    }).then(function(response){
      parseDates(response.data)
      for (var key in response.data) {
        $scope[key] = response.data[key]
      }
      console.log(response)
      return response.data
    })
  }
  load().then(function(response) {
    $scope.loading = false
  })

  $scope.delete = function(item,tbl) {
    $scope.form_loading = true
    $http({
      method:'post',
      url:host+'/delete?id='+item.id+'&tbl='+tbl
    }).then(load).then(function(response) {
      $scope.form_loading = false
    })
  }
  $scope.payment = function() {
    $scope.form_loading = true
    $http({
      method:'post',
      url:host+'/payment',
      data:{
        date:$scope.payment_form.date.$modelValue,
        amount:$scope.payment_form.amount.$modelValue
      }
    }).then(load).then(function(response){
      $scope.form_loading = false
    })
  }

  $scope.charge = function() {
    $scope.form_loading = true
    $http({
      method:'post',
      url:host+'/charge',
      data:{
        date:$scope.charge_form.date.$modelValue,
        amount:$scope.charge_form.amount.$modelValue,
        reason:$scope.charge_form.reason.$modelValue
      }
    }).then(load).then(function(response){
      $scope.form_loading = false
    })
  }

  $scope.setRate = function() {
    $scope.form_loading = true
    $http({
      method:'post',
      url:host+'/rate',
      data:{
        date:$scope.rate_form.date.$modelValue,
        rate:$scope.rate_form.rate.$modelValue + 4,
      }
    }).then(load).then(function(response){
      $scope.form_loading = false
    })
  }

  $scope.print = function() {
    $scope.form_loading = true
    $http({
      method:'get',
      url:host+'/print'
    }).then(function(response){
      parseDates(response.data)
      $scope.print_table = response.data
      var balance = 0
      for (var i = 0; i < $scope.print_table.length; i++) {
        var row = $scope.print_table[i]
        row.balance = balance += row.amount
        if (row.from != undefined) {
          row.desc = "Interest charges from "+$filter('date')(row.from)+" to "+$filter('date')(row.date)+" @"+row.rate+"%"
          row.type = "Interest"
        } else if (row.reason != undefined) {
          row.desc = row.reason
          row.type = "Charge"
        } else {
          row.desc = "Payment recieved on "+$filter('date')(row.date)
          row.type = "Payment"
        }
      }
    }).then(load).then(function(response) {
      $scope.form_loading = false
      $scope.view = 'print'
    })
  }
})
