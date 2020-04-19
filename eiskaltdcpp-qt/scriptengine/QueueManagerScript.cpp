/***************************************************************************
*                                                                         *
*   This program is free software; you can redistribute it and/or modify  *
*   it under the terms of the GNU General Public License as published by  *
*   the Free Software Foundation; either version 3 of the License, or     *
*   (at your option) any later version.                                   *
*                                                                         *
***************************************************************************/

#include "QueueManagerScript.h"
#include "WulforUtil.h"

#include <QDir>
#include <QDebug>
#include <iostream>
 
#include "dcpp/CID.h"
#include "dcpp/User.h"
#include "dcpp/QueueItem.h"

QueueManagerScript::QueueManagerScript(QObject *parent) :
    QObject(parent)
{
    QM = dcpp::QueueManager::getInstance();

    QM->addListener(this);
}

QueueManagerScript::~QueueManagerScript() {
    QM->removeListener(this);
}

bool QueueManagerScript::add(const QString& aTarget, quint64 aSize, const QString& root, const QString& aUser, const QString& aHub) {
    dcpp::ClientManager *CM = dcpp::ClientManager::getInstance();
    UserPtr user = CM->getUser(aUser.toStdString(), aHub.toStdString());

    QString path=_q(SETTING(DOWNLOAD_DIRECTORY));
    QString target = path + (path.endsWith(QDir::separator())? QString("") : QDir::separator()) + aTarget;
    try {
      QM->add( _tq(target), aSize, TTHValue(_tq(root)), HintedUser(user, aHub.toStdString()) );
    } catch (const Exception &) {
      return false;
    }
    return true;
}

bool QueueManagerScript::addFilelist(const QString& aUser, const QString& aHub) {
    dcpp::ClientManager *CM = dcpp::ClientManager::getInstance();
    UserPtr user = CM->getUser(aUser.toStdString(), aHub.toStdString());

    try {
      QM->addList( HintedUser(user, aHub.toStdString()), 0 );
    } catch (const Exception &) {
      return false;
    }
    return true;
}



QStringList QueueManagerScript::downloads() {
    QStringList ret;
    QString nick = "";

    QM = dcpp::QueueManager::getInstance();
    const QueueItem::StringMap& ll = QM->lockQueue();

    for (auto it = ll.begin(); it != ll.end(); ++it) {
        QueueItem* item = it->second;
        QString target =_q(item->getTargetFileName());
        QString tth = _q(item->getTTH().toBase32());
        QString size = QString::number(item->getSize());
        QString downloaded = QString::number(item->getDownloadedBytes());

        QString users;
        QueueItem::SourceConstIter s_it = item->getSources().begin();

        for (; s_it != item->getSources().end(); ++s_it){
            HintedUser usr = s_it->getUser();
            const dcpp::CID &cid = usr.user->getCID();

            nick = WulforUtil::getInstance()->getNicks(cid, _q(usr.hint));

            if (!nick.isEmpty()){
                users += nick + "(" + _q(cid.toBase32()) + ") ";
            }
        }

        ret.push_back(target + "::" + tth + "::" + size + "::" + downloaded + "::" + users);
    }
    QM->unlockQueue();

    return ret;
}

void QueueManagerScript::on(Finished, QueueItem* item, const dcpp::string& something, int64_t some_number) throw(){
    emit finished(_q(item->getTarget()));
}

void QueueManagerScript::on(SourcesUpdated, dcpp::QueueItem* item) throw() {
    QStringList list;
    dcpp::QueueItem::SourceList badSources = item->getBadSources();
    for (const auto& s : item->getBadSources()) {
        dcpp::CID cid = s.getUser().user->getCID();
        list.push_back(_q(cid.toBase32()));
    }
    emit sourcesUpdated(_q(item->getTTH().toBase32()), list);
}
