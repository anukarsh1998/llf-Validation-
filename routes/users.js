"use strict";
var express = require('express');
const nodemailer = require("nodemailer");
//var router = express.Router();
const Router = require('express-promise-router');
const router = new Router()
const pool = require('../db/dbConfig');
const verify = require('../config/verifyToken');
const jwt = require('jsonwebtoken');
const joi = require('@hapi/joi');
// const {check, validationResult }=require('express-validator');
router.post('/savePldForm',(request, response) => {

  console.log('request.body  : '+JSON.stringify(request.body));
  let contactId = request.body.contactId;
  let projectId = request.body.projectId;
  let pldFormUrl = request.body.pldFormUrl;
  let sentDate = request.body.sentDate;
  let projectName = request.body.projectName;
  let pldFormId = request.body.pldFormId;


  pool.query('insert into pld_forms (contactId,projectId,pldFormUrl,sentDate, projectName,pldFormId) values($1,$2,$3,$4,$5,$6)',[contactId,projectId,pldFormUrl, sentDate,projectName, pldFormId])
  .then((pldQueryResult) => {
        console.log('pldQueryResult  '+JSON.stringify(pldQueryResult));
        response.send(pldQueryResult);
  })
  .catch((pldQueryError) => {
      console.log('pldQueryError  '+JSON.stringify(pldQueryError));
      response.send(pldQueryError);
  })

});


router.get('/getpldForm',verify, (request, response) => {

  console.log('Expense request.user '+JSON.stringify(request.user));
  var userId = request.user.sfid; 

  console.log('request.query  : '+JSON.stringify(request.query));
  let contactId = request.query.contactId;

  pool.query('SELECT projectName, pldFormUrl, sentDate, pldformid  FROM pld_forms WHERE contactId = $1',[userId])
  .then((pldQueryResult) => {
        console.log('pldQueryResult  : '+JSON.stringify(pldQueryResult.rows));
        if(pldQueryResult.rowCount > 0)
        {
          response.send(pldQueryResult.rows); 
        }
        else{
          response.send([]);
        }
  })
  .catch((pldQueryError) => {
      console.log('pldQueryError :  '+pldQueryError);
      response.send([]);
  })

});


router.get('/viewResponses',verify,(request,response)=>{

  let pldFormId = request.query.pldformid;
  console.log('pldFormId : '+pldFormId );

  console.log('Expense request.user '+JSON.stringify(request.user));
  var userId = request.user.sfid; 

  pool
  .query('SELECT sfid, name, createdDate from salesforce.Project_Survey_Response__c WHERE Project_Library__c = $1 AND Response_By__c = $2',[pldFormId, userId])
  .then((pldResponseQueryResult) => {
    console.log('pldResponseQueryResult  '+JSON.stringify(pldResponseQueryResult.rows));
    if(pldResponseQueryResult.rowCount > 0)
    {
      response.send(pldResponseQueryResult.rows);
    }
    else
    {
      response.send([]);
    }

  })
  .catch((pldResponseQueryError) => {
    console.log('pldResponseQueryError : '+pldResponseQueryError.error);
    response.send([]);
  });

});

/* GET users listing. */
router.get('/login', function(req, response, next) {
    response.render('login');
});


router.post('/login', async (request,response)=>{

  const {email, password} = request.body;
  console.log('email : '+email+' passoword '+password);

  let errors = [], userId, objUser, isUserExist = false;

  if (!email || !password) {
    errors.push({ msg: 'Please enter all fields' });
    response.render('login',{errors});
  }

  await
  pool
  .query('SELECT Id, sfid, Name, email,PM_email__c FROM salesforce.Contact WHERE email = $1 AND password2__c = $2',[email,password])
  .then((loginResult) => {
        console.log('loginResult.rows[0]  '+JSON.stringify(loginResult.rows[0]));
        if(loginResult.rowCount > 0)
        {
          userId = loginResult.rows[0].sfid;
          objUser = loginResult.rows[0];
          isUserExist = true;
        }
        else
        {
          isUserExist = false;
        }      
  }) 
  .catch((loginError) =>{
    console.log('loginError   :  '+loginError.stack);
    isUserExist = false;
  })

  await 
  pool.query('SELECT sfid FROM salesforce.Team__c WHERE Manager__c =  $1 ',[userId])
  .then((teamQueryResult) => {
        if(teamQueryResult.rowCount > 0)
              objUser.isManager = true;
        else
              objUser.isManager = false; 
  })
  .catch((teamQueryError) => {

  })

  if(isUserExist && errors.length == 0)
  {
    const token = jwt.sign({ user : objUser }, process.env.TOKEN_SECRET, {
      expiresIn: 8640000 // expires in 24 hours
    });
  
    response.cookie('jwt',token, { httpOnly: false, secure: false, maxAge: 3600000 });
    response.header('auth-token', token).render('dashboard',{objUser});
  }
  else
  {
    response.render('login',{errors});
  }
    
}) 

router.get('/home',verify, (request, response) => {
    let objUser = request.user;
    response.render('dashboard',{objUser});
})


router.get('/getuser',verify, (request, response) => {

    console.log('request.user '+JSON.stringify(request.user));
    console.log('request.user.id   :  '+request.user.sfid);
    console.log('request.user.name :  '+request.user.name);
    response.send('Hello Amit');

});

router.get('/timesheet',verify,function(request,response){ 

  console.log('request.user '+JSON.stringify(request.user));
  var userId = request.user.sfid;
  let objUser = request.user;
  console.log('userId : '+userId);
//  response.render('timesheetcalendar');

   var projectName ='';
    pool
    .query('SELECT sfid, Name FROM salesforce.Contact  WHERE sfid = $1;',[userId])
    .then(contactResult => {
      console.log('Name of Contact  ::     '+contactResult.rows[0].name+' sfid'+contactResult.rows[0].sfid);
      var contactId = contactResult.rows[0].sfid;
        pool
        .query('SELECT sfid, Name, Team__c FROM salesforce.Team_Member__c WHERE Representative__c = $1 ;',[contactId])
        .then(teamMemberResult => {
          console.log('Name of TeamMemberId  : '+teamMemberResult.rows[0].name+'   sfid :'+teamMemberResult.rows[0].sfid);
          console.log('Team Id  : '+teamMemberResult.rows[0].team__c);
          console.log('Number of Team Member '+teamMemberResult.rows.length);
          
          var projectTeamparams = [], lstTeamId = [];
          for(var i = 1; i <= teamMemberResult.rows.length; i++) {
            projectTeamparams.push('$' + i);
            lstTeamId.push(teamMemberResult.rows[i-1].team__c);
          } 
          var projectTeamQueryText = 'SELECT sfid, Name, Project__c FROM salesforce.Project_Team__c WHERE Team__c IN (' + projectTeamparams.join(',') + ')';
          console.log('projectTeamQueryText '+projectTeamQueryText);
          
            pool
            .query(projectTeamQueryText,lstTeamId)
            .then((projectTeamResult) => {
                console.log('projectTeam Reocrds Length '+projectTeamResult.rows.length);
                console.log('projectTeam Name '+projectTeamResult.rows[0].name);
  
                var projectParams = [], lstProjectId = [];
                for(var i = 1; i <= projectTeamResult.rows.length; i++) {
                  projectParams.push('$' + i);
                  lstProjectId.push(projectTeamResult.rows[i-1].project__c);
                } 
                console.log('lstProjectId  : '+lstProjectId);
                var projetQueryText = 'SELECT sfid, Name FROM salesforce.Milestone1_Project__c WHERE sfid IN ('+ projectParams.join(',')+ ')';
  
                pool.
                query(projetQueryText, lstProjectId)
                .then((projectQueryResult) => { 
                      console.log('Number of Projects '+projectQueryResult.rows.length);
                      console.log('Project sfid '+projectQueryResult.rows[0].sfid+ 'Project Name '+projectQueryResult.rows[0].name);
                      var projectList = projectQueryResult.rows;
                      var lstProjectId = [], projectParams = [];
                      var j = 1;
                      projectList.forEach((eachProject) => {
                        console.log('eachProject sfid : '+eachProject.sfid);
                        lstProjectId.push(eachProject.sfid);
                        projectParams.push('$'+ j);
                        console.log('eachProject name : '+eachProject.name);
                        j++;
                      });
  
                    //  var milestoneQueryText = 'SELECT Id,Name FROM salesforce.Milestone1_Milestone__c WHERE Project__c IN ('+projectParams.join(',')+') AND Name = ;
                    //  pool.query
  
                  /*  var taskQueryText = 'SELECT task.sfid, task.Name, task.Project_Milestone__c, mile.sfid FROM salesforce.Milestone1_Task__c task, Salesforce.Milestone1_Milestone__c mile '
                    + 'WHERE '
                    + 'task.Project_Name__c IN ('+projectParams.join(',')+ ') ' 
                    + 'AND task.Project_Milestone__c = mile.sfid '
                    + 'AND mile.Name = \'Timesheet Category\'';  */
  
                    var taskQueryText = 'SELECT sfid, Name FROM salesforce.Milestone1_Task__c  WHERE Project_Name__c IN ('+projectParams.join(',')+') AND  Project_Milestone__c IN (SELECT sfid FROM salesforce.Milestone1_Milestone__c WHERE Name = \'Timesheet Category\') AND sfid IS NOT NULL';
                    console.log('taskQueryText  : '+taskQueryText);
  
  
  
                      pool
                      .query(taskQueryText, lstProjectId)
                      .then((taskQueryResult) => {
                          console.log('taskQueryResult  rows '+taskQueryResult.rows.length);
                          response.render('timesheetcalendar',{objUser, projectList : projectQueryResult.rows, contactList : contactResult.rows, taskList : taskQueryResult.rows }); // render calendar
                      })
                      .catch((taskQueryError) => {
                          console.log('taskQueryError : '+taskQueryError.stack);
                          response.send(403);
                      })
                      
                })
                .catch((projectQueryError) => {
                      console.log('projectQueryError '+projectQueryError.stack);
                      //response.send(403);
                      response.render('timesheetcalendar',{objUser, projectList : [], contactList : [], taskList : [] }); // render calendar
                })
             
            })
              .catch((projectTeamQueryError) =>{
                console.log('projectTeamQueryError : '+projectTeamQueryError.stack);
               // response.send(403);
               response.render('timesheetcalendar',{objUser, projectList : [], contactList : [], taskList : [] }); 
              })          
           })

          .catch((teamMemberQueryError) => {
            console.log('Error in team member query '+teamMemberQueryError.stack);
            //response.send(403);
            response.render('timesheetcalendar',{objUser, projectList : [], contactList : [], taskList : [] }); 
          })
  
        }) 
        .catch((contactQueryError) => {
            console.error('Error executing contact query', contactQueryError.stack);
            response.send(403);
        });
 
});


router.get('/getevents',verify, async function(req, res, next) {

  console.log('request.user '+JSON.stringify(req.user));
  var userId = req.user.sfid;
  console.log('userId : '+userId);

  
  console.log('req.query :'+req.query.date);
  var strdate = req.query.date;
  console.log('typeof date '+typeof(strdate));
  var selectedDate = new Date(strdate);
  console.log('selectedDate   : '+selectedDate);
  console.log('typeof(selectedDate)   : '+typeof(selectedDate));
  var year = selectedDate.getFullYear();
  var month = selectedDate.getMonth();
  console.log('Month '+selectedDate.getMonth());
  console.log('Year : '+selectedDate.getFullYear());
  var numberOfDays = new Date(year, month+1, 0).getDate();
  console.log('numberOfDays : '+numberOfDays);
  let plannedHoursMap = new Map();
  let actualHoursMap = new Map();

  function convert(str) {
    var date = new Date(str),
      mnth = ("0" + (date.getMonth() + 1)).slice(-2),
      day = ("0" + date.getDate()).slice(-2);
    return [date.getFullYear(), mnth, day].join("-");
  }  

  await pool.query('SELECT Id, sfid , Planned_Hours__c, Start_Date__c FROM salesforce.Milestone1_Task__c WHERE Assigned_Manager__c = $1',[userId])
  .then((taskQueryResult) => {
        if(taskQueryResult.rowCount > 0)
        {
              taskQueryResult.rows.forEach((eachTask) =>{
                  var date = convert(eachTask.start_date__c);
                  console.log('date  '+date+'  eachTask.planned_hours__c  : '+eachTask.planned_hours__c);
                 
                  console.log('plannedHoursMap.has(date)  '+plannedHoursMap.has(date));
                  console.log('Opposite plannedHoursMap.has(date)  '+(!plannedHoursMap.has(date)));
                  if( !plannedHoursMap.has(date))
                  {
                    plannedHoursMap.set(date, eachTask.planned_hours__c);
                    console.log('if Block '+eachTask.planned_hours__c);
                    if(eachTask.planned_hours__c != null)
                      plannedHoursMap.set(date, eachTask.planned_hours__c);
                    else
                      plannedHoursMap.set(date, 0);
                  }
                  else
                  {
                      
                      let previousHours = plannedHoursMap.get(date);
                      console.log('date   '+date +'  else Block Previous Hours : '+previousHours);
                      let currentHours = eachTask.planned_hours__c;
                      console.log('date   '+date +'  else Block Current Hours : '+currentHours);
                      if(currentHours != null)
                      {
                        console.log('date  '+date +'previousHours + currentHours  '+(previousHours + currentHours));
                        plannedHoursMap.set(date, previousHours + currentHours );
                      }
                  }
              })

              let mapIter = plannedHoursMap.entries();
              console.log('plannedHoursMap    size '+plannedHoursMap.size);
              
              console.log(mapIter.next().value);
              console.log(mapIter.next().value);
              console.log(mapIter.next().value);
              console.log(mapIter.next().value);
              console.log(mapIter.next().value);

              for (let key of plannedHoursMap.keys()) {
               console.log('key :'+key)
              }

              for(let value of plannedHoursMap.values()){
                console.log('values : '+value);
              }
        }
  })
  .catch((taskQueryError) => {
        console.log('taskQueryError   :  '+taskQueryError.stack);
  })




  await pool.query('SELECT sfid, date__c, calculated_hours__c FROM salesforce.Milestone1_Time__c WHERE sfid != \''+''+'\'')
  .then((timesheetQueryResult) => {
      console.log('timesheetQueryResult  '+JSON.stringify(timesheetQueryResult.rows));
      console.log('timesheetQueryResult.rowCount '+timesheetQueryResult.rowCount);
      if(timesheetQueryResult.rowCount > 0)
      {
        timesheetQueryResult.rows.forEach((eachTimesheet) => {
          
            let fillingDate = convert(eachTimesheet.date__c);
            console.log('fillingDate  '+fillingDate);

            if( ! actualHoursMap.has(fillingDate))
            {
                if(eachTimesheet.calculated_hours__c != null)
                  actualHoursMap.set(fillingDate, eachTimesheet.calculated_hours__c);
                else
                  actualHoursMap.set(fillingDate, 0);
            }
            else
            {
               let previousFilledHours =  actualHoursMap.get(fillingDate);
               let currentFilledHours = eachTimesheet.calculated_hours__c;
               if(currentFilledHours != null)
               {
                  actualHoursMap.set(fillingDate, (previousFilledHours + currentFilledHours));
               }
               else
                  actualHoursMap.set(fillingDate, (previousFilledHours + 0));
            }

            for(let time of actualHoursMap)
            {
              console.log('time  : '+time);
            }
          
        })
      }
      

  })
  .catch((timesheetQueryError) => {
    console.log('timesheetQueryError  '+timesheetQueryError.stack);
  })


  /* Start Actual Hours Query  Calculation */




  /* End Actual Hours Query  Calculation */


  console.log('Just above ')
  var lstEvents = [];
  for(let i = 1;i <= numberOfDays ; i++)
  {
      let day = i , twoDigitMonth = month+1;
      if(day >= 1 && day <= 9)
      {
          day = '0'+i;
      }
      if(twoDigitMonth >= 1 && twoDigitMonth <= 9)
      {
        twoDigitMonth = '0'+twoDigitMonth;
      }

      var date = year+'-'+twoDigitMonth+'-'+day;
     // console.log('date inside events '+date);
    //  console.log('plannedHoursMap.has(date)  '+plannedHoursMap.has(date))
      if(plannedHoursMap.has(date))
      {
          console.log('plannedHoursMap.get(date)  : '+plannedHoursMap.get(date));
          lstEvents.push({
            title : 'Planned Hours : '+plannedHoursMap.get(date),
            start : year+'-'+twoDigitMonth+'-'+day,   
          });
         
      }
      else
      {
          lstEvents.push({
            title : 'Planned Hours : '+'0',
            start : year+'-'+twoDigitMonth+'-'+day,   
          });
      }


      if(actualHoursMap.has(date))
      {
          lstEvents.push({
            title : 'Actual Hours : '+actualHoursMap.get(date),
            start : year+'-'+twoDigitMonth+'-'+day,   
          });
      }
      else
      {
          lstEvents.push({
            title : 'Actual Hours : '+'0',
            start : year+'-'+twoDigitMonth+'-'+day,   
          });
      }

      lstEvents.push({
        title : 'Create Task',
        start : year+'-'+twoDigitMonth+'-'+day,   
      });
      lstEvents.push({
        title : 'Details',
        start : year+'-'+twoDigitMonth+'-'+day,   
      });
      
      lstEvents.push({
        title : 'Fill Actuals',
        start : year+'-'+twoDigitMonth+'-'+day,   
      });
   
  } 
   // console.log('JSON.strigify '+JSON.stringify(lstEvents));
    res.send(lstEvents);
 });



router.get('/logout', (request, response) => {
 // request.logout();
 // request.flash('success_msg', 'You are logged out');
  response.redirect('/users/login');
});

router.get('/taskist',verify,(request,response)=>{
  let objUser = request.user;
  console.log('objUser  : '+JSON.stringify(objUser));
  response.render('taskViewList',{objUser});
})

router.get('/getTasklist',verify,(request,response)=>{
  let objUser=request.user;
  console.log('objUser.sfid '+objUser.sfid);
  let queryText = 'SELECT tsk.sfid as sfids, tsk.Assigned_Manager__c as assManager,tsk.end_time__c,tsk.Task_Type__c,tsk.Planned_Hours__c,tsk.Start_Time__c,tsk.name as tskname,tsk.createddate '+
                   'FROM salesforce.Milestone1_Task__c tsk '+ 
                   'WHERE  tsk.Assigned_Manager__c= $1 '+
                   'AND sfid IS NOT NULL ';
 console.log('queryText  taskkkkkkkkkkkkkkkkkkk',queryText);
  pool
   .query(queryText,[objUser.sfid])
  .then((taskQueryResult)=>{
    console.log('taskQueryResult '+JSON.stringify(taskQueryResult.rows));
    if(taskQueryResult.rowCount > 0)
    {
        let modifiedTaskList = [],i =1;
        taskQueryResult.rows.forEach((eachRecord) => {
          let obj = {};
          let createdDate = new Date(eachRecord.createddate);
          let strDate = createdDate.toLocaleString();
          obj.sequence = i;
          obj.name = '<a href="#" class="taskreferenceTag" id="'+eachRecord.sfids+'" >'+eachRecord.tskname+'</a>';
          obj.assigned = eachRecord.assmanager;
          obj.hrs=eachRecord.planned_hours__c;
          obj.startTime=eachRecord.start_time__c;
          obj.endtime=eachRecord.end_time__c;
          obj.taskType=eachRecord.task_type__c;
          obj.createDdate = strDate;
          obj.editAction = '<button href="#" class="btn btn-primary editTask" id="'+eachRecord.sfids+'" >Edit</button>'
          i= i+1;
          modifiedTaskList.push(obj);
        })
        response.send(modifiedTaskList);
    }
    else
    {
        response.send([]);
    }

  })
  .catch((QueryError) => {
    console.log('QueryError  '+QueryError.stack);
  }) 
})
router.get('/fetchTaskDetail',verify,(request,response)=>{
  let tskId=request.query.taskId;
  console.log('task ID '+tskId);
  pool
  .query('select sfid,name ,Assigned_Manager__c,end_time__c,Task_Type__c,Planned_Hours__c,Start_Time__c FROM salesforce.Milestone1_Task__c where sfid=$1 ',[tskId])
  .then((querryResult)=>{
    console.log('QUERRY rESULT'+ JSON.stringify(querryResult.rows));
    response.send(querryResult.rows);
  })
  .catch((querryError)=>{
    console.log('querryError '+querryError);
    response.send(querryError.stack)
})
})

router.post('/updateTask',verify,(request,response)=>{
  let body=request.body;
  console.log('Body '+ JSON.stringify(body));
  const {start,endTime , taskType, hrs, hide} = request.body;
  console.log('start '+ start);
  console.log('endTime '+ endTime);
  console.log('taskType '+ taskType);
  console.log('hr '+ hrs);
  console.log('hide '+ hide);
  let updateQuery= 'UPDATE salesforce.Milestone1_Task__c SET '+
                    'end_time__c = \''+endTime+'\', '+
                    'start_time__c = \''+start+'\', '+
                    'task_type__c = \''+taskType+'\' '+
                       'WHERE sfid = $1';
  console.log('updateQuerryyyyy '+updateQuery);
  pool
  .query(updateQuery,[hide])
  .then((queryResult)=>{
    console.log('queryResult '+JSON.stringify(queryResult.rows));
    response.send('successsss')
    .catch((querryError)=>{
      console.log('querryError'+querryError.stack);
      response.send(querryError);
    })
  })

  
})


router.get('/getTimesheestList',verify,(request,response)=>{
  let objUser = request.user;
  console.log('objUser  : '+JSON.stringify(objUser));
  response.render('getTimesheetViewList',{objUser});
})

router.get('/getTimesheetlist',verify,(request,response)=>{
  let objUser=request.user;
  console.log('objUser.sfid '+objUser.sfid);
  let queryText = 'SELECT sfid, Date__c,end_time__c,Hours__c,	Start_Time__c,name,Incurred_By__c,representative__c,createddate '+
                   'FROM salesforce.Milestone1_Time__c  '+ 
                   'WHERE  representative__c= $1 '+
                   'AND sfid IS NOT NULL ' ;
 console.log('queryText timesheetList',queryText);
  pool
  .query(queryText,[objUser.sfid])
  .then((timesheetQueryResult)=>{
    console.log('timesheetQueryResult '+JSON.stringify(timesheetQueryResult));
    if(timesheetQueryResult.rowCount > 0 && timesheetQueryResult.rows)
    {
        let modifiedList = [],i =1;
        timesheetQueryResult.rows.forEach((eachRecord) => {
          
          let obj = {};
          let createdDate = new Date(eachRecord.createddate);
          let strDate = createdDate.toLocaleString();
          let strDated = new Date(eachRecord.createddate);
          let strDated1 = strDated.toLocaleString();
          obj.sequence = i;
          obj.name = '<a href="#" class="taskreferenceTag" id="'+eachRecord.sfid+'" >'+eachRecord.name+'</a>';
          obj.hours=eachRecord.hours__c;
          obj.startTime=eachRecord.start_time__c;
          obj.endtime=eachRecord.end_time__c;
          obj.date=strDated1;
          obj.createDdate = strDate;
          obj.editAction = '<button href="#" class="btn btn-primary editTimesheet" id="'+eachRecord.sfid+'" >Edit</button>'
          i= i+1;
          modifiedList.push(obj);
          
        })
        response.send(modifiedList);
    }
    else
    {
        response.send([]);
    }

  })
  .catch((QueryError) => {
    console.log('QueryError  '+QueryError.stack);
    response.send(querryError);
  }) 
})
  
router.get('/fetchtimesheetkDetail',verify,(request,response)=>{
  let timesheetId= request.query.timesheetId;
  console.log('timesheet ID '+timesheetId);
 /*  let queryText = ;
console.log('queryText '+queryText); */
pool
.query('SELECT sfid,date__c,end_time__c,Hours__c,Start_Time__c,name,Incurred_By__c,representative__c,createddate FROM salesforce.Milestone1_Time__c WHERE sfid= $1 ',[timesheetId])
.then((querryResult)=>{
  console.log('queryrResult fetchqueryrResult fetchqueryrResult fetchqueryrResult fetch'+JSON.stringify(querryResult.rows));
  response.send(querryResult.rows);
})
.catch((QueryError)=>{
  console.log('querryError '+querryError.stack);
  response.send(querryError);
})
});

router.post('/updateTimesheet',verify,(request,response)=>{
  let body=request.body;
  console.log('Body '+ JSON.stringify(body));
  const {start,endTime , dt, hr, hide} = request.body;
  console.log('start '+ start);
  console.log('endTime '+ endTime);
  console.log('dt '+ dt);
  console.log('hr '+ hr);
  console.log('hide '+ hide);
  let updateQuery= 'UPDATE salesforce.Milestone1_Time__c SET '+
                    'end_time__c = \''+endTime+'\', '+
                    'Start_Time__c = \''+start+'\', '+
                       'date__c = \''+dt+'\' '+
                       'WHERE sfid = $1';
console.log('update Querry'+updateQuery);
pool
.query(updateQuery,[hide])
.then((querryResult)=>{
  console.log('querryResult '+JSON.stringify(querryResult));
  response.send('Success');
})
.catch((querryError)=>{
  console.log('querryError'+querryError.stack);
  response.send(querryError);
})
});
/*
Forget Password
*/
router.get('/forgotpassword',(req,res)=>{
  console.log('rendering'+JSON.req);
  res.render('forgetPassword');
})


router.post('/salesforceEmailVeerification',(request,response)=>{
  let emailEnter= request.body;
  const {emailPass }= request.body;
  console.log('emailAddress' +emailPass);
  console.log('Body'+JSON.stringify(emailEnter));
  let queryContact = 'SELECT sfid,email,name FROM salesforce.contact where email=$1' ;
  console.log('querry Contact '+queryContact);
  pool
  .query(queryContact,[emailPass])
  .then((querryResult)=>{
        console.log('queryResult: '+JSON.stringify(querryResult.rows));
        if(querryResult.rowCount==1)
        {
          response.send(querryResult.rows);
        }
        else
        {
          response.send('[]');
        }
  })
  .catch((QueryError)=>{
    console.log('Erros '+ QueryError.stack);
    response.send('QueryError');
  })
})

router.post('/sendEMail',(request,response)=>{
 let bodysent= request.body;
  const {email,sfid ,name} = request.body;
  console.log('emaoBidy' +email);
  console.log('sfid' +sfid);
  console.log('name' +name);
 /*  nodemailer.createTestAccount((err, account) => {
    if (err) {
        console.error('Failed to create a testing account. ' + err.message);
        return process.exit(1);
    }  */
    const transporter = nodemailer.createTransport({
     service:'gmail',
      auth: {
          user:'agupta3@kloudrac.com',
          pass:'Vishw@1234'
      }
  })
  let message = {
    from: 'agupta3@kloudrac.com',
    to:email,
    subject: 'Heroku Password Forget',
    text: 'Plz Click the below link to generate your password',
    html: '<p><a href="http://localhost:7500/users/resetPassword/'+sfid +'">click to resest your password</a></p>' 
  }

  transporter.sendMail(message, (err, info) => {
    if (err) {
        console.log('Error occurred. ' + err.message);
        return process.exit(1);
    }
    console.log('Message sent: %s', info.messageId);
    // Preview only available when sending through an Ethereal account
  //  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    response.send('Email Sent');
  })
})
router.get('/resetPassword/:userId',(request,response)=>{
  let userId = request.params.userId;
  console.log('userId  : '+userId);
  response.render('resetPassword',{userId});
})
router.post('/updatePass',(request,response)=>{
  console.log('BODy'+JSON.stringify(request.body));
  const { pass ,pass2, user}=request.body;
  let updateQuerryPass='UPDATE salesforce.contact SET '+
                 'password__c = \''+pass+'\', '+
                  'password2__c=\''+pass2+'\' '+
                  'WHERE sfid = $1';
                  console.log('update query'+updateQuerryPass);
  pool
  .query(updateQuerryPass,[user])
  .then((querryResult)=>{
    console.log('querryResult'+JSON.stringify(querryResult));
    response.send('DOne');
  })
  .catch((queryyError)=>{
    console.log('queryyError'+queryyError.stack);
    response.send('queryyError');
   })
})

router.get('/editProfile',verify,(request,response)=>{
  let objUser=request.user;
  let userId=objUser.sfid;
  console.log('Sfidddd :'+JSON.stringify(objUser));
  let queryContact = 'SELECT sfid,email,  postal_code__c,address__c,name FROM salesforce.contact where sfid=$1' ;
  pool
  .query(queryContact,[userId])
  .then((queryResult)=>{
    let userdetail=queryResult.rows[0];
    console.log('userdeat '+JSON.stringify(userdetail));
 /*    console.log('queryResult'+JSON.stringify(queryResult.rows));
    let obj = queryResult.rows;
    console.log('check'+JSON.stringify(obj[0]));
    let user =JSON.stringify(obj[0]); 
    console.log('user '+user);
    response.render('editProfile',{userI}); */
    response.render('editProfile',{userdetail, objUser});
  })
  .catch((QueryError)=>{
    console.log('QueryError'+QueryError.stack);
    response.send(QueryError);
  })
})
router.post('/updateProfile',(request,response)=>{
  
  /*  const errors = validationResult(req);
   if(!errors.isEmpty()){
     return res.status(422).JSON({errors:errors.array()})
   } */
 // request.checkQuery('postal','"Postal Code should not  be empty ').notEmpty().isInt();
  let bdy= request.body;
   const schema = joi.object({
    postal: joi.number().max(999999).min(100000),
   /*
    nam:joi.string().min(4).max(20)
    phn:joi.string().required(),
    add:joi.string(),
    uid:joi.string(), */
  }) 
 // const scema = joi.number().max(5);
  let result= schema.validate({postal:bdy.postal});
  console.log('resutk '+JSON.stringify(result));
  if(result.error){
    response.status(400).send(result.error.details[0].message)
    return;
    } 
  console.log('body : '+ JSON.stringify(bdy));
  const {nam , phn, postal,add,uid }=request.body;
  console.log('name '+nam);
  console.log('phn '+phn);
  console.log('napostalme '+postal);
  console.log('add '+add);
  console.log('uid '+uid);
  let qry ='UPDATE salesforce.contact SET '+
            'postal_code__c=\''+postal+'\', '+
            'address__c=\''+add+'\' '+
             'WHERE sfid = $1';
             console.log('qry '+qry);
  pool
  .query(qry ,[uid])
  .then((querryResult)=>{
    console.log('querryResult'+JSON.stringify(querryResult));
    response.send(querryResult);
  })
  .catch((qurryError)=>{
    console.log('qrryError ' +qurryError.stack);
    response.send(qurryError);
  })

});
/* 
    TAsk Activity Code 
 */
router.get('/taskDetail',verify,(req,res)=>{
  console.log('calling Activity Code Page')
  res.render('taskCode');
})
router.get('/fetchTASKCODE',verify,(request,response)=>{

  pool.query('select sfid ,name from salesforce.Milestone1_Milestone__c where Project__c =$1 and sfid!=$2',['a030p0000018ScOAAU','a020p0000035q9lAAA'])
  .then((querryRes)=>{
    console.log('querryRes'+JSON.stringify(querryRes.rows));
    var sId=[];
    querryRes.rows.forEach((eachRecord)=>{
     // console.log(JSON.stringify(eachRecord.sfid));
      sId.push(eachRecord.sfid);
    })
    console.log('IDSET are :'+sId);
    let qry ='Select sfid ,Activity_Code__c FROM salesforce.Milestone1_Task__c where sfid IS NOT NULL AND Project_Milestone__c IN ($1,$2,$3,$4,$5,$6)';
    console.log('qry qry '+qry);
    pool.query(qry,[sId[0],sId[1],sId[2],sId[3],sId[4],sId[5]]) 
  ///  let qry='Select sfid ,Activity_Code__c FROM salesforce.Milestone1_Task__c where sfid IS NOT NULL AND Project_Milestone__c IN '+'('+ sId+')';
  //  console.log('qriesssss +'+ qry); 
 //   pool.query(qry,[sId])
    .then((result)=>{
      console.log('result TAsk '+ JSON.stringify(result));
      if(result.rowCount>0)
      {
        var modifiedList=[],i=1
        result.rows.forEach((eachRecord)=>{
          let obj={};
          obj.sequence=i;
          obj.taskId=eachRecord.sfid;
          obj.activityCode=eachRecord.activity_code__c;
          i=i+1;
          modifiedList.push(obj);
        })
        console.log('modified list '+JSON.stringify(modifiedList));
        response.send(modifiedList)
      }
      else
      {
        response('[]');
      }
    })
    .catch((error)=>{
      console.log('error'+error.stack);
      response.send(error);
    })
  })
  .catch((queryEr)=>{
    console.log('queryEr'+queryEr.stack);
    response.send(queryEr);
  })
})
/* 
router.get('/taskdetail',verify,(request,response)=>{
  let idsProject='a030p0000018ScOAAU';
  pool.query('select sfid, from salesforce.Milestone1_Task__c where sfid IS NOT NULL')
  .then((queryResult)=>{
    console.log('queryResult '+JSON.stringify(queryResult));
    let result=JSON.stringify(queryResult.rows);
    response.render('taskcode',{idsProject},{result});
  })
});
router.get('/fetchtaskdetail',verify,(request,response)=>{
 let fetchQuerry='SELECT sfid ,name FROM salesforce.Milestone1_Task__c  WHERE Project_Milestone__c.project__c =$1';
 console.log('fetchQuerry '+fetchQuerry);
 let idsProject='a030p0000018ScOAAU';
 pool
 .query(fetchQuerry,[idsProject])
.then((querrtResult)=>{
  console.log('queryyResult '+JSON.stringify(querrtResult.rows))
  response.send('taskCode',{querrtResult});
})
.catch((QueryError)=>{
  console.log('QueryError '+QueryError.stack);
  response.send(QueryError);
})
});
 */

 module.exports = router;
